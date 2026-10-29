#!/usr/bin/env python3
"""Offline read-only alignment sketch, NOT a clinical/physical validation."""
import argparse
import datetime as dt
import json
import math
import statistics
import sys
from pathlib import Path


def timestamp(value):
    if not isinstance(value, str):
        raise ValueError('timestamp mora biti ISO 8601 tekst sa zonom')
    result = dt.datetime.fromisoformat(value.replace('Z', '+00:00'))
    if result.tzinfo is None:
        raise ValueError('timestamp mora imati vremensku zonu')
    return result.astimezone(dt.timezone.utc)


def finite(value):
    return isinstance(value, (int, float)) and not isinstance(value, bool) and math.isfinite(value)


def run(data, max_gap_minutes):
    # Identifiers stay in memory and are not printed. No database connection.
    devices = {}
    for row in data['devices']:
        key = row['id']
        if key in devices:
            raise ValueError('duplicirani device id')
        devices[key] = row['userId']
    predictions = {}
    for row in data['predictions']:
        key = row['eventId']
        if key in predictions or not finite(row['candidateFlowTemp']):
            raise ValueError('duplicirana ili neispravna predikcija')
        predictions[key] = row['candidateFlowTemp']
    histories = []
    for row in data['boilerHistories']:
        when = row.get('heatingStart') or row['createdAt']
        if not finite(row['suggestedFlowTemp']):
            raise ValueError('neispravna historijska preporuka')
        histories.append((row['userId'], timestamp(when), row['suggestedFlowTemp']))
    ids = set()
    differences = []
    missing_device = missing_history = missing_prediction = ambiguous_history = 0
    for event in data['heatingEvents']:
        key = event['id']
        if key in ids:
            raise ValueError('duplicirani event id')
        ids.add(key)
        user = devices.get(event['deviceId'])
        if user is None:
            missing_device += 1
            continue
        if key not in predictions:
            missing_prediction += 1
            continue
        event_time = timestamp(event['timestampStart'])
        choices = [(t, temp) for owner, t, temp in histories if owner == user and dt.timedelta(0) <= event_time - t <= dt.timedelta(minutes=max_gap_minutes)]
        if not choices:
            missing_history += 1
            continue
        latest = max(t for t, _ in choices)
        nearest = [temp for t, temp in choices if t == latest]
        if len(nearest) != 1:
            ambiguous_history += 1
            continue
        differences.append(predictions[key] - nearest[0])
    return {
        'scope': 'offline_alignment_only_not_causal_evaluation',
        'events': len(ids), 'matched': len(differences),
        'missing_device': missing_device, 'missing_prediction': missing_prediction,
        'missing_history': missing_history, 'ambiguous_history': ambiguous_history,
        'mean_delta_c': round(statistics.mean(differences), 4) if differences else None,
        'mean_absolute_delta_c': round(statistics.mean(abs(x) for x in differences), 4) if differences else None,
        'warning': 'Mnogi događaji mogu dijeliti istu historiju; nearest-prior povezivanje nije dokaz uzročnosti, ispravne lokacije, ishoda ni uštede.',
    }


def main():
    parser = argparse.ArgumentParser(description='Skica offline backtest poravnanja: čita JSON iz datoteke ili koristi sintetički primjer, ispisuje samo agregate; nema DB/mreže/upisa. Ne primjenjivati na kotao.')
    group = parser.add_mutually_exclusive_group(required=True)
    group.add_argument('--demo', action='store_true', help='Pokreni ugrađene sintetičke podatke.')
    group.add_argument('--input', type=Path, help='Putanja do unaprijed pripremljenog JSON-a: devices, heatingEvents, boilerHistories, predictions; ne koristiti produkcijske podatke bez odobrenja i anonimizacije.')
    parser.add_argument('--max-gap-minutes', type=float, default=60, help='Maksimalna starost prethodne historije u minutama (default 60).')
    args = parser.parse_args()
    if not math.isfinite(args.max_gap_minutes) or args.max_gap_minutes < 0:
        parser.error('max-gap-minutes mora biti konačan nenegativan broj')
    data = {'devices': [{'id': 1, 'userId': 1}], 'heatingEvents': [{'id': 1, 'deviceId': 1, 'timestampStart': '2026-01-01T12:00:00Z'}], 'boilerHistories': [{'userId': 1, 'createdAt': '2026-01-01T11:30:00Z', 'suggestedFlowTemp': 50}], 'predictions': [{'eventId': 1, 'candidateFlowTemp': 49}]} if args.demo else json.loads(args.input.read_text(encoding='utf-8'))
    print(json.dumps(run(data, args.max_gap_minutes), ensure_ascii=False, indent=2))


if __name__ == '__main__':
    try:
        main()
    except (ValueError, TypeError, KeyError, OSError) as exc:
        print('Neispravan ulaz ili nedostupna datoteka; pogledajte --help.', file=sys.stderr)
        sys.exit(2)
