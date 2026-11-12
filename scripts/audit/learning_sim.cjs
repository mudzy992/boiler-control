#!/usr/bin/env node
/*
 * LEARNING SIMULATION — da li predloženi sistem učenja zaista nađe kuću?
 *
 * Simulira jednu kuću sa POZNATIM parametrima (a, b), termostat sa stvarnom
 * histerezom 1,0 K, senzor sa rezolucijom 0,5 °C i evidenciju sa 60 s
 * kašnjenja — tačno ono što produkcija ima (polling je ograničen Tuya kvotom,
 * pa se finije uzorkovanje NE smije tražiti).
 *
 * Pušta dva režima:
 *   formula     : polazna = današnja formula (51 − 0,3·ext), zamrznuta po danu
 *   controller  : model + silazak do granice komfora (17-learning-design §8)
 *
 * i mjeri: da li identifikacija vrati pravi nagib s = b/a, koliko dana treba,
 * da li kontroler nađe minimum koji drži kuću, koliko puta podbaci i kako se
 * mijenja trajanje ciklusa.
 *
 * Identifikacija koristi DNEVNI BILANS ENERGIJE, ne derivacije:
 *   D·(F − R) = s·(R − O) − c
 * gdje su F/R/O dnevni prosjeci polazne, sobne i vanjske, a D je udio dana pod
 * grijanjem. To je klasična „energy signature" metoda: robustna na
 * kvantizaciju senzora i na kratke cikluse, za razliku od derivacijske.
 *
 * Ovo NIJE mjerenje stvarne kuće. Rezultat važi za model, ne za instalaciju.
 * Bez mreže, baze, tajni i bez izmjene aplikacijskog koda.
 */

'use strict';

const assert = require('node:assert');
const { execFileSync } = require('node:child_process');

// --- fiksne postavke sistema (iz koda, ne pretpostavke) -------------------
const DEAD_ZONE = 1.0;          // thermostat.polling.service.ts:48 (vlasnik: uvijek 1)
const SENSOR_STEP = 0.5;        // Tuya TempCurrent u pola stepena (44 -> 22.0)
const DETECT_LAG_MIN = 1;       // cron je svake minute -> do 60 s kašnjenja
const MIN_SWITCH_MIN = 2;       // MIN_SWITCH_INTERVAL_MIN
const FLOW_MIN = 30;            // bojler
const FLOW_MAX = 55;            // bojler
const TARGET_ROOM = 21.0;

// --- kontroler (17 §8) ----------------------------------------------------
const STEP_DOWN = 1.0;
const STEP_UP = 1.5;
const EPS_UNDERSHOOT = 1.0;     // odluka vlasnika
const DEADBAND = 0.5;
const DWELL_DAYS = 3;
const T_MAX_MIN = 120;
const MIN_DAYS_FOR_MODEL = 8;

const args = process.argv.slice(2);
if (args.includes('--help')) {
  console.log(`Upotreba: node scripts/audit/learning_sim.cjs [opcije]

  --days=<n>        broj dana simulacije (default 60)
  --house=<tip>     light | medium | heavy (default medium)
  --scenario=<s>    formula | controller | both (default both)
  --c=<0|1>         oduzimaj izmjereni c u ravnotežnoj polaznoj (default 1)
  --dayref=<0|1>    referenca 0,7·noć + 0,3·dnevni maks (default 1)
  --conservative=n  gornja CI granica prvih n dana (default 20, 0 = nikad)
  --ablate=<lista>  isključi članove: uday, cihigh, nightfloor, shortcycle
                    (zarezom; prazno = ništa isključeno)
  --table           puna tabela ablacije za sve tri kuće
  --self-test       samo provjeri da prekidači stvarno djeluju (traje par s)
  --trace           ispiši polaznu po danu
  --json            mašinski čitljiv izlaz
  --help            ova poruka

Napomena: do 2026-11-07 skripta nije oduzimala c, iako ga je fit procjenjivao
(c ≈ 0,92–1,01 K). Mjerila je kontroler koji u produkciji ne postoji. Sa
--c=1 (novo zadano) brojevi odgovaraju izrazu iz
backend/src/modules/DailyRecord/equilibrium-flow.ts; --c=0 reprodukuje stare
brojeve za poređenje.

Model kuće (lumped, jedan kapacitet):
  C·dT/dτ = k1·(T_flow − T_r) − k2·(T_r − T_out) + q_int
  a = k1/C,  b = k2/C,  nagib krivulje s = b/a

Tipovi kuće:
  light   C=4 MJ/K   k1=212 W/K  k2=160 W/K   a=0,191/h  b=0,144/h  s=0,754
  medium  C=6 MJ/K   k1=212 W/K  k2=200 W/K   a=0,127/h  b=0,120/h  s=0,943
  heavy   C=20 MJ/K  k1=200 W/K  k2=200 W/K   a=0,036/h  b=0,036/h  s=1,000

Simulacija: korak 1 min, senzor zaokružen na 0,5 °C, evidencija stanja sa 60 s
kašnjenja, histereza 1,0 K cijela ispod cilja. Rezultat nije uputa za
upravljanje kotlom.`);
  process.exit(0);
}

const num = (name, def) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return def;
  const v = Number(arg.slice(name.length + 3));
  if (!Number.isFinite(v) || v <= 0) {
    console.error(`Neispravna vrijednost za --${name}`);
    process.exit(2);
  }
  return v;
};

/** 0 je legitimna vrijednost za prekidače (isključeno), pa `num` ne služi. */
const flag = (name, def) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  if (!arg) return def;
  const v = Number(arg.slice(name.length + 3));
  if (!Number.isFinite(v) || v < 0) {
    console.error(`Neispravna vrijednost za --${name}`);
    process.exit(2);
  }
  return v;
};

const known = new Set(['--json', '--trace', '--help', '--table', '--self-test']);
const bad = args.filter(
  (a) =>
    !known.has(a) &&
    !/^--(days|house|scenario|c|dayref|conservative|ablate)=/.test(a),
);
if (bad.length) {
  console.error(`Nepoznat argument "${bad[0]}"; koristite --help`);
  process.exit(2);
}

const asJson = args.includes('--json');
const trace = args.includes('--trace');
const days = Math.round(num('days', 60));
const houseKey = (args.find((a) => a.startsWith('--house=')) ?? '--house=medium').split('=')[1];
const scenarioArg = (args.find((a) => a.startsWith('--scenario=')) ?? '--scenario=both').split('=')[1];

// F2: izraz ravnotežne polazne isti kao `equilibrium-flow.ts`.
//   F_eq = T + s·(T − O_ref) − c,  O_ref = (1−w)·noć + w·dnevni maks
const USE_C = flag('c', 1) === 1;
const USE_DAY_REF = flag('dayref', 1) === 1;
const CONSERVATIVE_DAYS = flag('conservative', 20);
/** Isti udio kao `DAY_REFERENCE_WEIGHT` u `equilibrium-flow.ts`. */
const DAY_WEIGHT = 0.3;
/** Kratki ciklus: ista granica kao `SHORT_CYCLE_MIN` u `proposal-controller.ts`. */
const SHORT_CYCLE_MIN = 6;

/**
 * F3.3 — ablacija: koji član stvarno nosi odluku.
 *
 * Do sada se svaki član mogao mijenjati pojedinačno (`--c=0`, `--dayref=0`,
 * `--conservative=0`), ali nije bilo načina da se **isključi pravilo kontrolera**
 * — noćna granica i kratki ciklusi bili su uvijek uključeni. Zato se nije moglo
 * reći da li se brojevi mijenjaju zbog formule ili zbog granice koja ih
 * prepisuje: granica je bila maska preko svega ispod nje.
 *
 * `--ablate=<lista>` gasi članove; sve što nije navedeno ostaje kako je.
 * Prazno (`--ablate=`) znači „ništa isključeno" — to je zlatni broj, i
 * `--self-test` provjerava da je taj broj **isti** kao bez prekidača.
 *
 *   uday        oduzmi `u_day` (`HomeModel.day-gain.ts`)
 *   cihigh      ne koristi gornju CI granicu nagiba dok je model mlad
 *   nightfloor  ne primjenjuj noćni minimum kao tvrdu granicu
 *   shortcycle  ne podiži zbog kratkih ciklusa
 */
const ABLATE_NAMES = ['uday', 'cihigh', 'nightfloor', 'shortcycle'];
function parseAblation(list) {
  const out = { uday: true, cihigh: true, nightfloor: true, shortcycle: true };
  const items = list.split(',').map((x) => x.trim()).filter(Boolean);
  for (const item of items) {
    if (!ABLATE_NAMES.includes(item)) {
      console.error(
        `Nepoznata ablacija "${item}"; poznate: ${ABLATE_NAMES.join(', ')}`,
      );
      process.exit(2);
    }
    out[item] = false; // isključeno
  }
  return out;
}
const ablationArg = (args.find((a) => a.startsWith('--ablate=')) ?? '--ablate=').split('=')[1];
const ABLATION = parseAblation(ablationArg);
const ablateMode = args.some((a) => a.startsWith('--ablate='));

/** Koji nagib ide u izraz — isti izbor kao `chooseSlope()` u `equilibrium-flow.ts`. */
function chooseSlope(model, day, ablation) {
  if (!ablation.cihigh) return model.s;
  return model.ci && day < CONSERVATIVE_DAYS && model.ci[1] >= model.s
    ? model.ci[1]
    : model.s;
}

const HOUSES = {
  light: { C: 4e6, k1: 212, k2: 160, label: 'laka konstrukcija' },
  medium: { C: 6e6, k1: 212, k2: 200, label: 'srednja konstrukcija' },
  heavy: { C: 20e6, k1: 200, k2: 200, label: 'teška konstrukcija' },
};
if (!HOUSES[houseKey]) {
  console.error(`Nepoznat tip kuće "${houseKey}". Dozvoljeno: ${Object.keys(HOUSES).join(', ')}`);
  process.exit(2);
}
if (!['formula', 'controller', 'both'].includes(scenarioArg)) {
  console.error('Nepoznat scenario. Dozvoljeno: formula, controller, both');
  process.exit(2);
}

// --- deterministički šum --------------------------------------------------
let seed = 20261108;
const resetSeed = () => { seed = 20261108; };
const rnd = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const gauss = () => {
  const u = Math.max(rnd(), 1e-9);
  const v = rnd();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

// --- vrijeme --------------------------------------------------------------
function outdoorAt(dayIndex, minuteOfDay) {
  const phase = (2 * Math.PI * dayIndex) / 45;
  const dailyMean = 1.5 + 5.5 * Math.cos(phase);   // −4 … +7 °C
  const amplitude = 2.0;
  const t = (minuteOfDay - 310) / 1440;            // min oko 05:10
  return dailyMean + amplitude * Math.cos(2 * Math.PI * t) + 0.15 * gauss();
}

const dayMinMax = (dayIndex) => {
  let mn = Infinity, mx = -Infinity;
  for (let m = 0; m < 1440; m += 5) {
    const t = outdoorAt(dayIndex, m);
    if (t < mn) mn = t;
    if (t > mx) mx = t;
  }
  return { min: mn, max: mx };
};

const nightMinFor = (dayIndex) => {
  let mn = Infinity;
  for (let m = 360; m < 1440; m += 5) mn = Math.min(mn, outdoorAt(dayIndex, m));
  for (let m = 0; m <= 360; m += 5) mn = Math.min(mn, outdoorAt(dayIndex + 1, m));
  return mn;
};

// današnja formula (16 §3.3), bez naučenog offseta
function formulaFlow(min, max) {
  const ext = Math.max(-15, Math.min(10, 0.7 * min + 0.3 * max));
  let base;
  if (ext >= 10) base = 45;
  else if (ext <= -15) base = 56;
  else base = 51 - 0.3 * ext;
  return Math.max(FLOW_MIN, Math.min(FLOW_MAX, base));
}

// --- pomoćne --------------------------------------------------------------
const round = (n, d = 2) =>
  typeof n === 'number' && Number.isFinite(n) ? Number(n.toFixed(d)) : n;

function median(xs) {
  if (!xs.length) return null;
  const a = [...xs].sort((x, y) => x - y);
  const m = Math.floor(a.length / 2);
  return a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2;
}

// --- identifikacija: dnevni bilans energije ------------------------------
// D·(F − R) = s·(R − O) − c
function dailyRows(obs, flowByDay) {
  const byDay = new Map();
  for (const o of obs) {
    if (!byDay.has(o.day)) byDay.set(o.day, { on: 0, n: 0, room: 0, out: 0 });
    const d = byDay.get(o.day);
    d.n++;
    if (o.heating) d.on++;
    d.room += o.room;
    d.out += o.out;
  }
  const rows = [];
  for (const [day, d] of byDay) {
    if (d.n < 1200) continue;                       // nepotpun dan
    const flow = flowByDay.get(day);
    if (typeof flow !== 'number') continue;         // polazna nije poznata
    const D = d.on / d.n;
    const R = d.room / d.n;
    const O = d.out / d.n;
    if (D < 0.05 || D > 0.98) continue;             // nema kontrasta
    if (Math.abs(R - O) < 5) continue;              // preslab signal
    if (Math.abs(R - TARGET_ROOM) > 2) continue;    // dan nije bio u ravnoteži
    rows.push({ day, y: D * (flow - R), x: R - O });
  }
  return rows;
}

function fitLine(rows) {
  const n = rows.length;
  if (n < MIN_DAYS_FOR_MODEL) return null;
  let sx = 0, sy = 0, sxx = 0, sxy = 0;
  for (const r of rows) { sx += r.x; sy += r.y; sxx += r.x * r.x; sxy += r.x * r.y; }
  const den = n * sxx - sx * sx;
  if (Math.abs(den) < 1e-9) return null;
  const slope = (n * sxy - sx * sy) / den;
  const intercept = (sy - slope * sx) / n;
  const resid = rows.map((r) => r.y - (slope * r.x + intercept));
  const mad = median(resid.map((v) => Math.abs(v))) ?? 0;
  return { slope, intercept, resid, mad, n };
}

function estimateModel(obs, flowByDay) {
  let rows = dailyRows(obs, flowByDay);
  let fit = fitLine(rows);
  if (!fit) return { s: null, c: null, ci: null, days: rows.length, method: 'insufficient' };

  // odbaci dane sa velikim rezidualom (otvoren prozor, gosti, sunce) i ponovi
  if (fit.mad > 0) {
    const kept = rows.filter((_, i) => Math.abs(fit.resid[i]) <= 3 * fit.mad);
    if (kept.length >= MIN_DAYS_FOR_MODEL && kept.length < rows.length) {
      const refit = fitLine(kept);
      if (refit) { rows = kept; fit = refit; }
    }
  }

  // bootstrap preko dana
  const boots = [];
  for (let k = 0; k < 300; k++) {
    const sample = [];
    for (let i = 0; i < rows.length; i++) sample.push(rows[Math.floor(rnd() * rows.length)]);
    const f = fitLine(sample);
    if (f && f.slope > 0.1 && f.slope < 3) boots.push(f.slope);
  }
  boots.sort((a, b) => a - b);
  const ci = boots.length
    ? [boots[Math.floor(boots.length * 0.05)], boots[Math.floor(boots.length * 0.95)]]
    : null;

  // Ostatak po danu — ulaz za `u_day`. Fit je `y = s·x + intercept`, pa je
  // ostatak `y − predviđeno`; dobitak je suprotnog znaka (v. day-gain.ts).
  const residByDay = new Map();
  for (let i = 0; i < rows.length; i++) {
    const predicted = fit.slope * rows[i].x + fit.intercept;
    residByDay.set(rows[i].day, rows[i].y - predicted);
  }

  return {
    s: fit.slope > 0.1 && fit.slope < 3 ? fit.slope : null,
    c: Number.isFinite(fit.intercept) ? -fit.intercept : null,
    ci,
    days: rows.length,
    mad: fit.mad,
    method: 'energy-signature',
    residByDay,
  };
}

/**
 * `u_day` iz ostatka — isti izraz kao `HomeModel/day-gain.ts`.
 *
 *   predviđeno = s·x − c        (x = cilj − vanjska, iz istog fita)
 *   ostatak    = y − predviđeno (y = stvarno predato grijanje tog dana)
 *   dobitak    = −ostatak
 *
 * Medijana zadnjih 7 dana, granica ±2 K, bez 4 dana nema broja (`null`).
 * Ovo postoji zbog `--ablate=uday`: bez njega se tvrdi da član „ne mijenja
 * mnogo" a nikad nije ni izmjeren. Fit u `estimateModel` ga ne daje jer je
 * `c` već u njemu; `u_day` je **dnevni dodatak** na prosječan dan.
 */
const DAY_GAIN_CAP_C = 2;
const DAY_GAIN_WINDOW_DAYS = 7;
const DAY_GAIN_MIN_DAYS = 4;

function dayGainFrom(residByDay, flowByDay, day) {
  const points = [];
  for (const [d, resid] of residByDay) {
    if (d >= day) continue;
    // Ostatak je u jedinicama polazne (fit je y = s·x − c), pa je dobitak
    // direktno −ostatak; nema preračunavanja u sobnu temperaturu ovdje.
    points.push({ d, gainC: -resid });
  }
  points.sort((a, b) => a.d - b.d);
  const recent = points.slice(-DAY_GAIN_WINDOW_DAYS);
  if (recent.length < DAY_GAIN_MIN_DAYS) return null;
  const values = recent.map((p) => p.gainC);
  const raw = median(values);
  return Math.round(
    Math.min(DAY_GAIN_CAP_C, Math.max(-DAY_GAIN_CAP_C, raw)) * 10,
  ) / 10;
}

// derivacijska metoda — zadržana kao kontrolna, očekuje se da podbaci
function derivativeWindows(obs) {
  let offLong = 0, onLong = 0;
  let start = 0;
  for (let i = 1; i <= obs.length; i++) {
    if (i === obs.length || obs[i].heating !== obs[start].heating) {
      const len = i - start;
      if (len >= 45) {
        if (obs[start].heating) onLong++;
        else offLong++;
      }
      start = i;
    }
  }
  return { offLong, onLong };
}

// --- simulacija -----------------------------------------------------------
// Unutrašnji dobici: 200 W bazno + dnevna varijacija (sunce, gosti, kuhanje).
//
// Bez varijacije `u_day` je uvijek nula i `--ablate=uday` ne dokazuje ništa:
// ablacija člana koji je po konstrukciji nula „pokazuje da član ništa ne
// mijenja" — a to nije nalaz nego tautologija. Varijacija je istog reda kao
// ±1–2 K ekvivalenta polazne iz `17` §1.
const qIntBase = 200;                        // W
const Q_INT_DAY_SPREAD = 450;                // W, ± oko baze (sunce kroz prozor)

/**
 * Dnevni dobitak (sunce, gosti, kuhanje), ±450 W oko 200 W baze.
 *
 * Spori udio ima period od 9 dana (sunčan period), plus mali dnevni šum. Spori
 * udio je namjeran: `u_day` je **medijana zadnjih 7 dana** i mjeri dobitke koji
 * traju. Na bijelom šumu bi mjerio ništa i ablacija bi „dokazala" da član ne
 * radi — a dokazala bi samo da simulirana kuća nema šta da izmjeri.
 *
 * Nema `resetSeed` zavisnosti: deterministički po danu, pa dva pokretanja sa
 * istim `--days` daju isti niz bez obzira na to šta je prije izračunato.
 */
function dayIntGain(day) {
  const slow = Math.cos((2 * Math.PI * day) / 9);
  return qIntBase + Q_INT_DAY_SPREAD * (0.55 * slow + 0.45 * (2 * rnd() - 1));
}

function simulate(house, scenario, ablation = ABLATION) {
  resetSeed();
  const { C, k1, k2 } = house;

  const trueA = (k1 / C) * 3600;
  const trueB = (k2 / C) * 3600;

  let room = TARGET_ROOM - 0.5;
  let heating = false;
  let flow = null;

  const obs = [];
  const flowByDay = new Map();
  const dayLog = [];

  let lastSwitchMin = -999;
  let heatingPrev = false;
  let lastChangeDay = -99;
  let lastProposal = null;
  let prevHeatingForRecord = false;

  for (let day = 0; day < days; day++) {
    const { min, max } = dayMinMax(day);
    const nightMin = nightMinFor(day);
    // Dobitak tog dana. Računa se prije modela da bi isti broj važio i za fit i
    // za izraz (inače bi fit i primjena gledali dvije različite kuće).
    //
    // Varijacija **traje danima**, kao sunčan period ili gosti koji ostaju:
    // `u_day` je medijana zadnjih 7 dana, pa na čistom dnevnom šumu mjeri
    // veličinu koje u kući nema. To bi bio artefakt modela, ne nalaz o članu.
    const qInt = dayIntGain(day);
    const model = day >= 1 ? estimateModel(obs, flowByDay) : { s: null };
    // `u_day` se računa samo kad ga ablacija ne gasi i kad model ima fit —
    // inače ostaje `undefined` i izraz ga tretira kao 0 (kao `null` u kodu).
    if (model.s !== null && model.residByDay && ABLATION.uday) {
      model.uDay = dayGainFrom(model.residByDay, flowByDay, day);
    }

    let next;
    if (scenario === 'formula') {
      next = formulaFlow(min, max);
    } else {
      let base;
      if (model.s !== null) {
        // F2: isti izraz kao `backend/src/modules/DailyRecord/equilibrium-flow.ts`
        //   F_eq = T + s·(T − O_ref) − c
        // `--c=0` / `--dayref=0` reprodukuju staro ponašanje za poređenje.
        const slope = chooseSlope(model, day, ablation);
        const oRef = USE_DAY_REF ? (1 - DAY_WEIGHT) * nightMin + DAY_WEIGHT * max : nightMin;
        const cTerm = USE_C && typeof model.c === 'number' ? model.c : 0;
        const uTerm = ablation.uday && typeof model.uDay === 'number' ? model.uDay : 0;
        base = TARGET_ROOM + slope * (TARGET_ROOM - oRef) - cTerm - uTerm;
      } else {
        base = formulaFlow(min, max);
      }
      base = Math.max(FLOW_MIN, Math.min(FLOW_MAX, base));
      next = base;

      const prev = dayLog[dayLog.length - 1];
      if (prev && lastProposal !== null && day - lastChangeDay >= DWELL_DAYS) {
        const undershoot = TARGET_ROOM - prev.minRoom;
        // Kratki ciklusi: dan sa medijanom kraćom od SHORT_CYCLE_MIN traži
        // korak gore, i to prije provjere udobnosti (spuštanje ih je i
        // proizvelo). `--ablate=shortcycle` gasi samo taj razlog.
        const shortCycles =
          ablation.shortcycle && typeof prev.medianCycle === 'number'
            ? prev.medianCycle < SHORT_CYCLE_MIN
            : false;
        if (shortCycles) {
          next = Math.min(lastProposal + STEP_UP, base + 2);
          lastChangeDay = day;
        } else if (undershoot > EPS_UNDERSHOOT) {
          next = Math.min(lastProposal + STEP_UP, base + 2);
          lastChangeDay = day;
        } else if (prev.minRoom >= TARGET_ROOM - EPS_UNDERSHOOT) {
          next = lastProposal - STEP_DOWN;
          lastChangeDay = day;
        }
        if (Math.abs(next - lastProposal) < DEADBAND) next = lastProposal;
      }

      // noćni minimum je tvrda granica
      if (!ablation.nightfloor) {
        // ablacija: granica se ne primjenjuje, da se vidi nosi li odluku
      } else if (model.s !== null) {
        const slope = chooseSlope(model, day, ablation);
        const oRef = USE_DAY_REF ? (1 - DAY_WEIGHT) * nightMin + DAY_WEIGHT * max : nightMin;
        const cTerm = USE_C && typeof model.c === 'number' ? model.c : 0;
        const uTerm = ablation.uday && typeof model.uDay === 'number' ? model.uDay : 0;
        const guard = TARGET_ROOM + slope * (TARGET_ROOM - oRef) - cTerm - uTerm;
        if (guard > next && guard <= FLOW_MAX) next = guard;
      }
    }

    flow = Math.round(Math.max(FLOW_MIN, Math.min(FLOW_MAX, next)) * 10) / 10;
    flowByDay.set(day, flow);
    lastProposal = flow;

    let dayMinRoom = room;
    let reachedAtMin = null;
    let dayCycles = 0;
    // Trajanja ciklusa tog dana — ulaz za pravilo `SHORT_CYCLES`. Bez ovoga
    // `--ablate=shortcycle` nema šta da isključi: pravilo bi uvijek vuklo
    // `undefined`, tiho se nikad ne bi primijenilo, a ablacija bi izgledala
    // kao „pravilo ne mijenja ništa".
    const dayCycleDurations = [];
    let dayCycleStart = null;

    for (let m = 0; m < 1440; m++) {
      const tMin = day * 1440 + m;
      const tOut = outdoorAt(day, m);
      const sensor = Math.round(room / SENSOR_STEP) * SENSOR_STEP;

      if (heating) {
        if (sensor >= TARGET_ROOM) heating = false;
      } else if (sensor <= TARGET_ROOM - DEAD_ZONE) {
        heating = true;
      }
      if (heating !== heatingPrev) {
        if (tMin - lastSwitchMin >= MIN_SWITCH_MIN) {
          lastSwitchMin = tMin;
          if (heating) {
            dayCycles++;
            dayCycleStart = tMin;
          } else if (dayCycleStart !== null) {
            dayCycleDurations.push(tMin - dayCycleStart);
            dayCycleStart = null;
          }
        } else {
          heating = heatingPrev;
        }
        heatingPrev = heating;
      }

      const q = heating ? Math.max(0, k1 * (flow - room)) : 0;
      room += ((q - k2 * (room - tOut) + qInt) / C) * 60;
      room = Math.max(-10, Math.min(40, room));

      // „dostigao cilj" = ušao u kvant ispod cilja. Sa senzorom 0,5 °C i
      // histerezom 1,0 K soba fizički ne prelazi cilj — gasi se na prvom
      // kvantu ≥ cilj, pa je stvarni plafon ≈ cilj − 0,25 K.
      const sensorNow = Math.round(room / SENSOR_STEP) * SENSOR_STEP;
      if (m >= 360 && reachedAtMin === null && sensorNow >= TARGET_ROOM - SENSOR_STEP) {
        reachedAtMin = m - 360;
      }
      dayMinRoom = Math.min(dayMinRoom, room);

      // evidencija sa 60 s kašnjenja: stanje koje je važilo u prethodnoj minuti
      obs.push({
        day,
        room: Math.round(room / SENSOR_STEP) * SENSOR_STEP,
        out: Math.round(tOut * 2) / 2,
        heating: prevHeatingForRecord,
      });
      prevHeatingForRecord = heating;
    }

    // Ciklus koji je u toku na kraju dana ima poznato trajanje do ponoći —
    // kraće od stvarnog, ali nikad duže, pa ne može lažno prijaviti kratak
    // ciklus kao dug. Suprotno bi blokiralo učenje tiho.
    if (dayCycleStart !== null) dayCycleDurations.push(day * 1440 + 1440 - dayCycleStart);

    dayLog.push({
      day, flow,
      minRoom: dayMinRoom,
      reachedMin: reachedAtMin,
      cycles: dayCycles,
      medianCycle: dayCycleDurations.length ? median(dayCycleDurations) : null,
      nightMin,
      modelS: model.s,
      modelU: typeof model.uDay === 'number' ? model.uDay : null,
    });
  }

  return { trueA, trueB, trueS: trueB / trueA, obs, flowByDay, dayLog };
}

// --- metrike --------------------------------------------------------------
function cycleDurations(obs) {
  const out = [];
  let start = null;
  for (let i = 0; i < obs.length; i++) {
    if (obs[i].heating && start === null) start = i;
    if (!obs[i].heating && start !== null) {
      out.push(i - start);
      start = null;
    }
  }
  return out;
}

const r1 = (n) => (typeof n === 'number' && Number.isFinite(n) ? Math.round(n * 10) / 10 : n);

function run(scenario) {
  const house = HOUSES[houseKey];
  const res = simulate(house, scenario);
  const durations = cycleDurations(res.obs);

  const marks = [5, 10, 20, 40, 60].filter((d) => d <= days);
  const modelTrace = marks.map((d) => {
    const flows = new Map();
    for (const [k, v] of res.flowByDay) if (k < d) flows.set(k, v);
    const est = estimateModel(res.obs.slice(0, d * 1440), flows);
    return {
      day: d,
      s: est.s === null ? null : round(est.s, 3),
      ci: est.ci ? [round(est.ci[0], 3), round(est.ci[1], 3)] : null,
      daysUsed: est.days,
    };
  });

  const flows = res.dayLog.map((d) => d.flow);
  const quarter = Math.max(1, Math.floor(durations.length * 0.25));
  const firstDurations = durations.slice(0, quarter);
  const lastDurations = durations.slice(-quarter);

  const after10 = res.dayLog.filter((d) => d.day >= 10);
  const badAfter10 = after10.filter((d) => TARGET_ROOM - d.minRoom > EPS_UNDERSHOOT);

  return {
    house: houseKey,
    scenario,
    trueA: round(res.trueA, 4),
    trueB: round(res.trueB, 4),
    trueS: round(res.trueS, 3),
    modelTrace,
    derivatives: derivativeWindows(res.obs),
    flow: {
      start: flows[0],
      end: flows[flows.length - 1],
      min: Math.min(...flows),
      max: Math.max(...flows),
      meanLast10: round(flows.slice(-10).reduce((a, b) => a + b, 0) / Math.min(10, flows.length), 2),
    },
    cycles: {
      total: res.dayLog.reduce((acc, d) => acc + d.cycles, 0),
      perDayMean: round(res.dayLog.reduce((acc, d) => acc + d.cycles, 0) / days, 2),
      medianFirst: firstDurations.length ? median(firstDurations) : null,
      medianLast: lastDurations.length ? median(lastDurations) : null,
      dutyPercent: round(
        (100 * res.dayLog.reduce((acc, d) => acc + d.cycles, 0) * 1) / days,
        1,
      ),
    },
    comfort: {
      undershootDaysAfter10: badAfter10.length,
      daysAfter10: after10.length,
      worstUndershoot: round(Math.max(0, ...res.dayLog.map((d) => TARGET_ROOM - d.minRoom)), 2),
      daysOverTmax: res.dayLog.filter((d) => d.reachedMin !== null && d.reachedMin > T_MAX_MIN).length,
    },
    flowAboveRoomDaily: round(
      res.dayLog.reduce((acc, d) => acc + (d.flow - TARGET_ROOM), 0) / days, 2,
    ),
    dayLog: res.dayLog.map((d) => ({
      day: d.day,
      flow: d.flow,
      minRoom: round(d.minRoom, 2),
      reachedMin: d.reachedMin,
      cycles: d.cycles,
      medianCycle: d.medianCycle,
      nightMin: round(d.nightMin, 1),
      modelS: d.modelS === null ? null : round(d.modelS, 3),
      modelU: d.modelU,
    })),
  };
}

// --- izlaz ----------------------------------------------------------------
const scenarios = scenarioArg === 'both' ? ['formula', 'controller'] : [scenarioArg];
const results = scenarios.map(run);

if (asJson) {
  console.log(JSON.stringify({ days, house: houseKey, results }, null, 2));
  process.exit(0);
}

const pad = (s, n) => String(s).padEnd(n);
console.log(`Simulacija učenja — kuća "${houseKey}" (${HOUSES[houseKey].label}), ${days} dana`);
console.log(`  fiksno: DEAD_ZONE=${DEAD_ZONE} K (uvijek), senzor=${SENSOR_STEP} °C,`);
console.log(`          kašnjenje=${DETECT_LAG_MIN} min, cilj=${TARGET_ROOM} °C, raspon ${FLOW_MIN}–${FLOW_MAX} °C`);
console.log('');

for (const r of results) {
  console.log(`── scenario: ${r.scenario.toUpperCase()} ───────────────────────────────`);
  console.log(`  istina:            a=${r.trueA}/h  b=${r.trueB}/h  s=b/a=${r.trueS}`);
  console.log('  identifikacija (dnevni bilans):');
  for (const m of r.modelTrace) {
    const ci = m.ci ? `CI ${m.ci[0]}–${m.ci[1]}` : 'CI —';
    console.log(`    dan ${pad(m.day, 3)} s=${pad(m.s ?? '—', 7)} ${pad(ci, 18)} dana u fit-u: ${m.daysUsed}`);
  }
  console.log(`  derivacijska metoda: prozora ≥45 min — mirovanje ${r.derivatives.offLong}, grijanje ${r.derivatives.onLong}`);
  console.log(`  polazna:           ${r.flow.start} → ${r.flow.end} °C (min ${r.flow.min}, max ${r.flow.max}, zadnjih 10 dana ${r.flow.meanLast10})`);
  console.log(`  ciklusi:           ${r.cycles.total} (${r.cycles.perDayMean}/dan), medijana ${r.cycles.medianFirst} → ${r.cycles.medianLast} min`);
  console.log(`  komfor:            podbačaj > ${EPS_UNDERSHOOT} K poslije dana 10: ${r.comfort.undershootDaysAfter10}/${r.comfort.daysAfter10} dana,` +
    ` najgori ${r.comfort.worstUndershoot} K, sporije od ${T_MAX_MIN} min: ${r.comfort.daysOverTmax}`);
  console.log(`  polazna iznad sobe: ${r.flowAboveRoomDaily} K/dan (proxy, nije mjera uštede)`);
  console.log('');

  if (trace && r.scenario === 'controller') {
    console.log('  tok po danu (dan: polazna / najniža soba / s):');
    for (const d of r.dayLog) {
      console.log(`    ${pad(d.day, 3)} ${pad(d.flow, 6)} ${pad(d.minRoom, 7)} ${d.modelS ?? '—'}`);
    }
    console.log('');
  }
}

// --- tvrdnje --------------------------------------------------------------
const ctl = results.find((r) => r.scenario === 'controller');
if (ctl) {
  const lastKnown = [...ctl.modelTrace].reverse().find((m) => m.s !== null);
  assert.ok(lastKnown, 'identifikacija nije vratila nijedan nagib');
  assert.ok(
    Math.abs(lastKnown.s - ctl.trueS) <= 0.2,
    `nagib ${lastKnown.s} odstupа od istine ${ctl.trueS} više od 0,2`,
  );
  assert.ok(ctl.flow.end < ctl.flow.start, 'kontroler nije spustio polaznu');
  assert.ok(ctl.flow.min >= FLOW_MIN && ctl.flow.max <= FLOW_MAX, 'polazna izašla iz 30–55');
  if (ctl.cycles.medianLast !== null && ctl.cycles.medianFirst !== null) {
    assert.ok(
      ctl.cycles.medianLast > ctl.cycles.medianFirst,
      'ciklusi se nisu produžili uprkos nižoj polaznoj',
    );
  }
  if (ctl.comfort.daysAfter10 > 0) {
    assert.ok(
      ctl.comfort.undershootDaysAfter10 / ctl.comfort.daysAfter10 <= 0.15,
      `podbačaj > ${EPS_UNDERSHOOT} K na više od 15% dana poslije dana 10`,
    );
  }
}
console.log('Tvrdnje prošle.');

// --- F3.3 ablacija ---------------------------------------------------------
/**
 * Ablacija: isključi jedan član, vidi šta se promijeni.
 *
 * `--ablate=<lista>` gasi navedene članove i ispisuje samo taj jedan red — to
 * je ručni režim. Bez `--ablate` i sa `--table`, ispisuje se puna tabela
 * (svaki član posebno, pa svi zajedno), jer se jedino tako vidi **koji član
 * nosi odluku**, a ne samo da neki od njih nešto mijenja.
 *
 * `--self-test` ne mjeri ništa o kući: provjerava da prekidači **stvarno
 * djeluju**. To je jedina stvar koja se ovdje može tiho pokvariti — ako
 * `--ablate` prestane da mijenja izraz (npr. jer se član čita iz zaglavlja
 * modula), tabela bi izgledala uredno a svi redovi bi bili isti.
 */
const ABLATE_SETS = [
  ['ništa (zlatni)', ''],
  ['bez u_day', 'uday'],
  ['bez CI gornje', 'cihigh'],
  ['bez noćne granice', 'nightfloor'],
  ['bez kratkih ciklusa', 'shortcycle'],
  ['bez svih', 'uday,cihigh,nightfloor,shortcycle'],
];

function ablateRow(house, list) {
  const output = execFileSync(
    process.execPath,
    [
      __filename,
      `--days=${days}`,
      `--house=${house}`,
      '--scenario=controller',
      '--json',
      `--ablate=${list}`,
    ],
    { encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  const result = JSON.parse(output).results[0];
  const u = result.dayLog.map((d) => d.modelU).filter((x) => typeof x === 'number');
  return {
    end: result.flow.end,
    cycles: result.cycles.perDayMean,
    undershoot: `${result.comfort.undershootDaysAfter10}/${result.comfort.daysAfter10}`,
    worst: result.comfort.worstUndershoot,
    uRange: u.length ? [Math.min(...u), Math.max(...u)] : null,
  };
}

if (args.includes('--self-test')) {
  // Dvije provjere, obje o tome da prekidač djeluje:
  //  1. prazna ablacija mora dati ISTI rezultat kao pokretanje bez prekidača;
  //  2. isključivanje noćne granice mora promijeniti bar jednu metriku — ako ne
  //     promijeni, granica je mrtva ili je prekidač prikopčan na pogrešno mjesto.
  const same = JSON.stringify(ablationArg) === JSON.stringify('');
  assert.ok(same, 'self-test mora ići bez --ablate');
  const baseline = run('controller');
  const viaFlag = ablateRow(houseKey, '');
  assert.strictEqual(
    viaFlag.end,
    baseline.flow.end,
    'prazna ablacija je promijenila polaznu — prekidač nije neutralan',
  );
  const noFloor = ablateRow(houseKey, 'nightfloor');
  const changed =
    noFloor.end !== baseline.flow.end ||
    noFloor.cycles !== baseline.cycles.perDayMean ||
    noFloor.worst !== baseline.comfort.worstUndershoot;
  assert.ok(changed, 'isključena noćna granica nije promijenila nijednu metriku');

  // `u_day` mora stvarno varirati — inače njegova ablacija ne dokazuje ništa.
  const u = baseline.dayLog.map((d) => d.modelU).filter((x) => typeof x === 'number');
  assert.ok(u.length > 0, 'u_day nikad nije izračunat');
  assert.ok(
    Math.max(...u) > 0.1 && Math.min(...u) < -0.1,
    'u_day ne varira — ablacija bi bila tautologija',
  );

  console.log('F3.3 self-test: prekidači djeluju, u_day varira.');
  process.exit(0);
}

if (args.includes('--table') || ablateMode) {
  const houses = ablateMode ? [houseKey] : ['light', 'medium', 'heavy'];
  for (const house of houses) {
    console.log(`Ablacija — kuća "${house}", ${days} dana`);
    console.log('  ' + pad('postavka', 22) + pad('polazna', 9) + pad('cikl/dan', 10) + pad('podbačaj', 10) + pad('najgori', 9) + 'u_day');
    for (const [label, list] of ABLATE_SETS) {
      if (ablateMode && list !== ablationArg) continue;
      const row = ablateRow(house, list);
      const u = row.uRange ? `${row.uRange[0]}…${row.uRange[1]}` : '—';
      console.log(
        '  ' +
          pad(label, 22) +
          pad(row.end, 9) +
          pad(row.cycles, 10) +
          pad(row.undershoot, 10) +
          pad(row.worst, 9) +
          u,
      );
    }
    console.log('');
  }
}

