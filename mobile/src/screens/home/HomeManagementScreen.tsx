import { useState } from 'react';
import { RefreshControl, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useToast } from '../../components/ui/nativewind';

import {
  homeProfileApi,
  type CreateHomeProfileDto,
} from '../../services/api/homeProfile.api';
import {
  InsulationType,
  WindowType,
  HeatingType,
  SeasonMode,
  INSULATION_TYPE_OPTIONS,
  WINDOW_TYPE_OPTIONS,
  HEATING_TYPE_OPTIONS,
  SEASON_MODE_OPTIONS,
} from '../../constants/homeProfileEnums';
import { homeProfileToForm, type HomeProfileFormValues } from './homeProfileForm';
import {
  boilerSelectionError,
  brandChoices,
  brandOfFamily,
  familyChoices,
  outputChoices,
  selectionHint,
  isKnownFamilyId,
} from './boilerCatalog';
import { useTranslation } from '../../hooks/useTranslation';

import {
  Button,
  DeviceName,
  EmptyState,
  Field,
  FieldGroup,
  Panel,
  PanelRow,
  InlineBanner,
  Pressable,
  Screen,
  ScreenBody,
  ScreenHeader,
  Segmented,
  Sheet,
  SkeletonRows,
  SliderField,
  Text,
  MonoLabel,
  MonoMeta,
  Toggle,
  useTokens,
} from '../../ui';
import { radius, space } from '../../theme/tokens';

/**
 * F10 (HOME-THEME): „Moji domovi", „Dodaj dom" i „Izmjena doma" su bili
 * posljednji ekrani u starom NativeWind sloju, pa su na tamnoj temi imali
 * bijele kartice sa `gray.800` tekstom i `brand.500` okvirom — dakle drugu
 * paletu od ostatka aplikacije. Sada sve ide kroz `src/ui` primitive:
 *
 *  - kartica doma = `Panel` sa signalnom lijevom ivicom kad je dom aktivan
 *    (prije: `borderColor: brand.500` po cijeloj kartici, pa je aktivan dom
 *    izgledao kao greška);
 *  - forma = JEDNA komponenta `HomeForm` za dodavanje i izmjenu. Prije su
 *    postojala dva gotovo identična modala (razlika: dva polja), pa je svaka
 *    ispravka morala da se uradi dvaput — i jednom je zaboravljena („Location"
 *    nije bilo u formi za izmjenu, iako ga backend prima);
 *  - polja kroz `Field`, prekidač kroz `Toggle`, temperature kroz `SliderField`
 *    (sve iz `src/ui`), pa nema nijedne hex boje u ekranu;
 *  - `Select` starog sloja zamijenjen `Segmented`-om gdje je izbor kratak, a
 *    `Sheet`-om sa radio listom gdje je duži — isti obrazac kao filter perioda
 *    na Plinu.
 */


/* ------------------------------------------------------------------ */
/* Uslužno                                                            */
/* ------------------------------------------------------------------ */

interface HomeProfile {
  id: number;
  name?: string | null;
  location?: string | null;
  isActive: boolean;
  thermostats: number;
  createdAt: string;
  [key: string]: unknown;
}

const INSULATION_LABEL_KEY: Record<string, string> = {
  STANDARD: 'standard',
  EPS: 'eps',
  MINERAL_WOOL: 'mineralWool',
  ADVANCED: 'advanced',
};

const WINDOW_LABEL_KEY: Record<string, string> = {
  SINGLE_GLAZED: 'singleGlazed',
  DOUBLE_GLAZED: 'doubleGlazed',
  TRIPLE_GLAZED: 'tripleGlazed',
};

const HEATING_LABEL_KEY: Record<string, string> = {
  RADIATOR: 'radiator',
  UNDERFLOOR: 'underfloor',
  MIXED: 'mixed',
};

const SEASON_LABEL_KEY: Record<string, string> = {
  WINTER: 'winter',
  SUMMER: 'summer',
  // `AUTO` je u backendu moguć, a u prijevodu nema svoj ključ — namjerno ide
  // na „summer" kao i prije (F1), umjesto da prikaže enum vrijednost.
  AUTO: 'summer',
};

const INSULATION_THICKNESS_OPTIONS = [10, 12, 15, 20];

type Choice = { value: string; label: string };

/**
 * `ChoiceField` — birač sa malim brojem opcija.
 *
 * Do 3 opcije: `Segmented` u punoj širini (isti obrazac kao Očitanja/Analiza).
 * Više od 3: red koji otvara `Sheet` sa radio listom — jer bi 5 segmenata na
 * 360 px dalo tekst od 9 px, a to je bio upravo problem starog `Select`-a
 * (sivkasta kutija bez oznake koja se otvara).
 */
function ChoiceField({
  label,
  options,
  value,
  onChange,
  required = false,
  testID,
}: {
  label: string;
  options: Choice[];
  value: string;
  onChange: (next: string) => void;
  required?: boolean;
  testID?: string;
}) {
  const { t } = useTokens();
  const { t: tr } = useTranslation();
  const [open, setOpen] = useState(false);
  const selected = options.find((option) => option.value === value);

  if (options.length <= 3) {
    return (
      <FieldGroup label={label} required={required}>
        <SegmentedInline options={options} value={value} onChange={onChange} testID={testID} />
      </FieldGroup>
    );
  }

  return (
    <FieldGroup label={label} required={required}>
      <Pressable
        onPress={() => setOpen(true)}
        accessibilityRole="combobox"
        accessibilityLabel={`${label}: ${selected?.label ?? ''}`}
        accessibilityState={{ expanded: open }}
        testID={testID}
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          minHeight: 52,
          paddingHorizontal: space.md,
          backgroundColor: t.raised,
          borderColor: t.line,
          borderWidth: 1,
          borderRadius: radius.control,
        }}
      >
        <Text size="body">{selected?.label ?? '—'}</Text>
        <Ionicons name="chevron-down" size={16} color={t.inkDim} />
      </Pressable>
      <Sheet
        isOpen={open}
        onClose={() => setOpen(false)}
        title={label}
        closeLabel={tr('common.close')}
        snapPoints={['55%', '80%']}
        scrollable
        testID={testID ? `${testID}-sheet` : undefined}
      >
        <View style={{ gap: 0 }}>
          {options.map((option, index) => {
            const active = option.value === value;
            return (
              <Pressable
                key={option.value}
                onPress={() => {
                  onChange(option.value);
                  setOpen(false);
                }}
                accessibilityRole="radio"
                accessibilityState={{ selected: active }}
                accessibilityLabel={option.label}
                testID={testID ? `${testID}-option-${option.value}` : undefined}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: space.md,
                  minHeight: 52,
                  paddingHorizontal: space.sm,
                  borderBottomWidth: index < options.length - 1 ? 1 : 0,
                  borderBottomColor: t.line,
                }}
              >
                <Ionicons
                  name={active ? 'radio-button-on' : 'radio-button-off'}
                  size={18}
                  color={active ? t.signal : t.inkDim}
                />
                <Text size="bodyLg" weight={active ? 'semibold' : 'regular'} style={{ flex: 1 }}>
                  {option.label}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </Sheet>
    </FieldGroup>
  );
}

/** `Segmented` sa tri kratke opcije, bez spoljnog okvira panela. */
function SegmentedInline({
  options,
  value,
  onChange,
  testID,
}: {
  options: Choice[];
  value: string;
  onChange: (next: string) => void;
  testID?: string;
}) {
  return (
    <Segmented
      options={options.map((option) => ({ value: option.value, label: option.label }))}
      value={value}
      onChange={onChange}
      testID={testID}
    />
  );
}

/** Numeričko polje koje ne gubi stanje dok korisnik kuca (decimalni zarez). */
function NumberField({
  label,
  value,
  onChangeValue,
  suffix,
  testID,
  required = false,
}: {
  label: string;
  value: number;
  onChangeValue: (next: number) => void;
  suffix?: string;
  testID?: string;
  required?: boolean;
}) {
  // Lokalni tekst, jer `String(value)` na svaki otkucaj briše zarez koji je
  // korisnik upravo napisao („2," → parseFloat → 2 → „2"). Isti kvar kao
  // GAS-02 na Plinu.
  const [text, setText] = useState(String(value));

  return (
    <FieldGroup label={suffix ? `${label} (${suffix})` : label} required={required}>
      <Field
        numeric
        value={text}
        keyboardType="decimal-pad"
        inputMode="decimal"
        testID={testID}
        onChangeText={(next) => {
          const normalized = next.replace(',', '.');
          setText(next);
          if (normalized.trim() === '') return;
          const parsed = Number.parseFloat(normalized);
          if (Number.isFinite(parsed)) onChangeValue(parsed);
        }}
        onBlur={() => setText(String(value))}
      />
    </FieldGroup>
  );
}


const HomeManagementScreenContent = () => {
  const { t } = useTokens();
  const navigation = useNavigation();
  const queryClient = useQueryClient();
  const { t: tr } = useTranslation();
  const toast = useToast();

  /*
   * Katalog bojlera (`25` §5.1). Ne blokira formu: ako padne, forma radi bez
   * izbora modela — što je sigurno stanje (nema savjeta o snižavanju), a ne
   * bijeli ekran.
   */
  const { data: catalog } = useQuery({
    queryKey: ['boilerCatalog'],
    queryFn: homeProfileApi.getBoilerCatalog,
    staleTime: 1000 * 60 * 60,
  });

  const [showForm, setShowForm] = useState(false);
  const [editingHome, setEditingHome] = useState<HomeProfile | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const emptyForm = (): HomeProfileFormValues => ({
    homeName: '',
    location: '',
    floorArea: 100,
    ceilingHeight: 2.6,
    insulationType: InsulationType.STANDARD,
    insulationThickness: 12,
    windowType: WindowType.DOUBLE_GLAZED,
    heatingType: HeatingType.RADIATOR,
    constructionYear: new Date().getFullYear(),
    hasFloorHeating: false,
    targetMorningTemp: 22,
    targetDayTemp: 20,
    targetNightTemp: 18,
    numberOfResidents: 2,
    boilerModel: '',
    boilerCatalogId: '',
    boilerOutputKw: null,
    maxHeatingFlowC: null,
    seasonMode: SeasonMode.WINTER,
  });

  const [formData, setFormData] = useState<HomeProfileFormValues>(emptyForm);
  const resetForm = () => {
    setFormData(emptyForm());
    setBoilerBrandOverride(null);
  };

  /*
   * Marka se pamti odvojeno od profila: profil pamti porodicu, a marka je samo
   * korak do nje. Kad se dom učita, marka se izvodi iz porodice — inače bi
   * forma otvorila prvi korak prazan i izgledalo bi da model nije sačuvan.
   */
  const [boilerBrandOverride, setBoilerBrandOverride] = useState<string | null>(
    null,
  );
  const boilerBrand =
    boilerBrandOverride ?? brandOfFamily(catalog, formData.boilerCatalogId);

  /**
   * Validacija vraća PRVU grešku na bosanskom. Poruke su u `homeProfile.form`
   * bloku, pa nema novih stringova u kodu.
   */
  const validateForm = (): string | null => {
    if (!formData.homeName.trim()) return tr('homeProfile.form.homeNameRequired');
    if (formData.location && formData.location.length > 120)
      return tr('homeProfile.form.locationTooLong');
    if (formData.floorArea < 10 || formData.floorArea > 2000)
      return tr('homeProfile.form.floorAreaRange');
    if (formData.ceilingHeight < 1.8 || formData.ceilingHeight > 5)
      return tr('homeProfile.form.ceilingHeightRange');
    if (formData.constructionYear < 1900 || formData.constructionYear > 2100)
      return tr('homeProfile.form.constructionYearRange');
    if (formData.numberOfResidents < 1 || formData.numberOfResidents > 20)
      return tr('homeProfile.form.residentsRange');
    if (formData.insulationThickness < 5 || formData.insulationThickness > 30)
      return tr('homeProfile.form.insulationThicknessRange');
    const temps = [formData.targetMorningTemp, formData.targetDayTemp, formData.targetNightTemp];
    if (temps.some((value) => value < 5 || value > 30))
      return tr('homeProfile.form.temperatureRange');
    if (
      formData.maxHeatingFlowC != null &&
      (formData.maxHeatingFlowC < 30 || formData.maxHeatingFlowC > 55)
    )
      return tr('homeProfile.form.maxHeatingFlowRange');

    /*
     * Porodica + snaga je jedna odluka (`25` §5.1). Server odbija isto, ali
     * poruka tu stiže kao „Failed to save"; ovdje se vidi prije slanja i tačno
     * koja snaga postoji.
     */
    const boilerError = boilerSelectionError(
      catalog,
      formData.boilerCatalogId,
      formData.boilerOutputKw,
    );
    if (boilerError) return boilerError;

    return null;
  };

  const getErrorMessage = (err: unknown) => {
    if (err && typeof err === 'object' && 'response' in err) {
      const response = (err as { response?: { data?: { message?: unknown } } }).response;
      const message = response?.data?.message;
      if (Array.isArray(message)) return message.join(', ');
      if (typeof message === 'string') return message;
    }
    if (err instanceof Error) return err.message;
    return tr('homeManagement.genericError');
  };

  /**
   * Forma → DTO. Izdvojeno jer se ista konverzija koristi za dodavanje i
   * izmjenu, a `null` i `''` ovdje imaju različito značenje:
   *
   *   - prazan model se šalje kao `null` (briše odabir), ne kao `''` — backend
   *     bi `''` odbio kao nepoznat zapis;
   *   - snaga bez modela se **ne šalje**, jer je backend odbija (`25` §5.1);
   *   - `maxHeatingFlowC` prazno ide kao `null` = granica kotla, nikad kao 55.
   */
  const toPayload = () => {
    const hasModel = formData.boilerCatalogId !== '';
    return {
      ...formData,
      boilerCatalogId: hasModel ? formData.boilerCatalogId : null,
      boilerOutputKw: hasModel ? (formData.boilerOutputKw ?? null) : null,
      maxHeatingFlowC: formData.maxHeatingFlowC ?? null,
    };
  };

  /**
   * F10 (HOME-FORM): jedna `submit` funkcija za oba režima.
   *
   * Prije su postojala dva gotovo identična modala sa po jednom `handleAdd` /
   * `handleEdit` funkcijom. Greške validacije su išle kroz toast, pa je poruka
   * nestajala za 3 s i nije bila vezana za polje koje je pogrešno — sada se
   * prikazuje u samoj formi (`formError`) i ostaje dok se ne ispravi.
   */
  const submitForm = () => {
    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }
    setFormError(null);
    if (editingHome) {
      if (updateHomeMutation.isPending) return;
      updateHomeMutation.mutate({ id: editingHome.id, data: toPayload() });
      return;
    }
    if (createHomeMutation.isPending) return;
    createHomeMutation.mutate(toPayload() as CreateHomeProfileDto);
  };

  const handleDeleteHome = (home: HomeProfile) => {
    if (home.isActive) {
      toast.show({ description: tr('homeManagement.cannotDeleteActive') });
      return;
    }
    if (deleteHomeMutation.isPending) return;
    deleteHomeMutation.mutate(home.id);
  };

  const openAddForm = () => {
    setEditingHome(null);
    setFormData(emptyForm());
    setFormError(null);
    setShowForm(true);
  };

  const openEditForm = (home: HomeProfile) => {
    setEditingHome(home);
    // MO2-20: preserve 0/false/empty-string values; only null/undefined use defaults.
    setFormData(homeProfileToForm(home));
    setFormError(null);
    setShowForm(true);
  };

  const closeForm = () => {
    setShowForm(false);
    setEditingHome(null);
    resetForm();
    setFormError(null);
  };


  // Fetch home profiles
  const {
    data: homes = [],
    isLoading,
    isRefetching,
    isError,
    error,
    refetch,
  } = useQuery({
    queryKey: ['homeProfiles'],
    queryFn: homeProfileApi.getAllHomeProfiles,
  });

  // Switch active home
  const switchHomeMutation = useMutation({
    mutationFn: (homeId: number) => homeProfileApi.switchActiveHome(homeId),
    onMutate: async (homeId: number) => {
      await queryClient.cancelQueries({ queryKey: ['homeProfiles'] });
      const previousHomes = queryClient.getQueryData<HomeProfile[]>(['homeProfiles']);
      if (previousHomes) {
        queryClient.setQueryData<HomeProfile[]>(
          ['homeProfiles'],
          previousHomes.map((h) => ({ ...h, isActive: h.id === homeId }))
        );
      }
      return { previousHomes };
    },
    onError: (err, _homeId, context) => {
      if (context?.previousHomes) {
        queryClient.setQueryData(['homeProfiles'], context.previousHomes);
      }
      toast.show({ description: getErrorMessage(err) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['activeHomeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.show({ description: tr('homeManagement.homeSwitched') });
    },
  });

  // Create home
  const createHomeMutation = useMutation({
    mutationFn: homeProfileApi.createHomeProfile,
    onMutate: async (data) => {
      await queryClient.cancelQueries({ queryKey: ['homeProfiles'] });
      const previousHomes = queryClient.getQueryData<HomeProfile[]>(['homeProfiles']);
      const optimisticId = Date.now() * -1;
      const optimisticHome: HomeProfile = {
        id: optimisticId,
        name: data.homeName,
        location: data.location || '',
        isActive: previousHomes?.some((h) => h.isActive) ? false : true,
        thermostats: 0,
        createdAt: new Date().toISOString(),
      } as HomeProfile;

      if (previousHomes) {
        queryClient.setQueryData<HomeProfile[]>(
          ['homeProfiles'],
          [...previousHomes, optimisticHome]
        );
      }

      return { previousHomes };
    },
    onError: (err, _data, context) => {
      if (context?.previousHomes) {
        queryClient.setQueryData(['homeProfiles'], context.previousHomes);
      }
      toast.show({ description: getErrorMessage(err) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['activeHomeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowForm(false);
      resetForm();
      toast.show({ description: tr('homeManagement.homeAdded') });
    },
  });

  // Update home
  const updateHomeMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: any }) =>
      homeProfileApi.updateHomeProfile(id, data),
    onMutate: async ({ id, data }) => {
      await queryClient.cancelQueries({ queryKey: ['homeProfiles'] });
      const previousHomes = queryClient.getQueryData<HomeProfile[]>(['homeProfiles']);
      if (previousHomes) {
        queryClient.setQueryData<HomeProfile[]>(
          ['homeProfiles'],
          previousHomes.map((h) =>
            h.id === id
              ? {
                  ...h,
                  ...data,
                  name: data.homeName ?? h.name,
                  location: data.location ?? h.location,
                }
              : h
          )
        );
      }
      return { previousHomes };
    },
    onError: (err, _payload, context) => {
      if (context?.previousHomes) {
        queryClient.setQueryData(['homeProfiles'], context.previousHomes);
      }
      toast.show({ description: getErrorMessage(err) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['activeHomeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      setShowForm(false);
      setEditingHome(null);
      resetForm();
      toast.show({ description: tr('homeManagement.homeUpdated') });
    },
  });

  // Delete home
  const deleteHomeMutation = useMutation({
    mutationFn: (homeId: number) => homeProfileApi.deleteHomeProfile(homeId),
    onMutate: async (homeId: number) => {
      await queryClient.cancelQueries({ queryKey: ['homeProfiles'] });
      const previousHomes = queryClient.getQueryData<HomeProfile[]>(['homeProfiles']);
      if (previousHomes) {
        queryClient.setQueryData<HomeProfile[]>(
          ['homeProfiles'],
          previousHomes.filter((h) => h.id !== homeId)
        );
      }
      return { previousHomes };
    },
    onError: (err, _id, context) => {
      if (context?.previousHomes) {
        queryClient.setQueryData(['homeProfiles'], context.previousHomes);
      }
      toast.show({ description: getErrorMessage(err) });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['homeProfiles'] });
      queryClient.invalidateQueries({ queryKey: ['activeHomeProfile'] });
      queryClient.invalidateQueries({ queryKey: ['dashboard'] });
      toast.show({ description: tr('homeManagement.homeDeleted') });
    },
  });

  const anyMutationPending =
    switchHomeMutation.isPending ||
    createHomeMutation.isPending ||
    updateHomeMutation.isPending ||
    deleteHomeMutation.isPending;

  /* ------------------------------------------------------------------ */
  /* Kartica doma                                                       */
  /* ------------------------------------------------------------------ */

  const HomeCard = ({ home }: { home: HomeProfile }) => (
    <Pressable
      onPress={() => {
        if (anyMutationPending) return;
        if (!home.isActive) switchHomeMutation.mutate(home.id);
      }}
      disabled={anyMutationPending}
      accessibilityRole="button"
      accessibilityLabel={`${home.name ?? ''}${home.isActive ? ` — ${tr('homeManagement.active')}` : ''}`}
      accessibilityHint={tr('homeManagement.setActive')}
      accessibilityState={{ selected: Boolean(home.isActive), disabled: Boolean(anyMutationPending) }}
      testID={`home-card-${home.id}`}
      style={{ opacity: anyMutationPending ? 0.6 : 1 }}
    >
      <Panel
        variant={home.isActive ? 'hero' : 'plain'}
        padded={false}
        testID={`home-card-panel-${home.id}`}
      >
        <PanelRow divider={false}>
          <View style={{ flex: 1, minWidth: 0, gap: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.sm }}>
              {/*
                Naziv doma velikim slovima (korisnikov zahtjev). `transform` je
                stil, ne `toUpperCase()` na stringu — pa čitač ekrana i dalje
                čita prirodan naziv, a kopiranje teksta ne mijenja podatak.
              */}
              <DeviceName
                name={home.name}
                size="section"
                weight="semibold"
                style={{ flex: 1 }}
              />
              {home.isActive ? (
                <View
                  style={{
                    borderWidth: 1,
                    borderColor: t.ok,
                    borderRadius: radius.tag,
                    paddingHorizontal: space.xs,
                    paddingVertical: 2,
                  }}
                >
                  <Text size="label" weight="monoSemiBold" tone="ok" style={{ letterSpacing: 0.8 }}>
                    {tr('homeManagement.active').toUpperCase()}
                  </Text>
                </View>
              ) : null}
            </View>

            {home.location ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
                <Ionicons name="location-outline" size={12} color={t.inkDim} />
                <MonoMeta>{home.location}</MonoMeta>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs }}>
              <Ionicons name="thermometer-outline" size={12} color={t.inkDim} />
              <MonoMeta>
                {tr('homeManagement.thermostatCount', { count: home.thermostats })}
              </MonoMeta>
            </View>

            {/* Akcije su u SVOM redu, odvojenе hairline-om: prije su visjele uz
                desnu ivicu kartice i bilo ih je lako promašiti pored glavnog
                dodira koji mijenja aktivan dom (dva suprotna ishoda u 10 px). */}
            <View
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                gap: space.md,
                marginTop: space.xs,
                paddingTop: space.sm,
                borderTopWidth: 1,
                borderTopColor: t.line,
              }}
            >
              <Pressable
                onPress={(event) => {
                  event?.stopPropagation?.();
                  openEditForm(home);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${tr('homeManagement.edit')}: ${home.name ?? ''}`}
                testID={`home-edit-${home.id}`}
                style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 32 }}
              >
                <Ionicons name="create-outline" size={14} color={t.inkMuted} />
                <Text size="meta" weight="medium" tone="muted">
                  {tr('homeManagement.edit')}
                </Text>
              </Pressable>

              {!home.isActive ? (
                <Pressable
                  onPress={(event) => {
                    event?.stopPropagation?.();
                    handleDeleteHome(home);
                  }}
                  disabled={anyMutationPending}
                  accessibilityRole="button"
                  accessibilityLabel={`${tr('homeManagement.delete')}: ${home.name ?? ''}`}
                  accessibilityState={{ disabled: Boolean(anyMutationPending) }}
                  testID={`home-delete-${home.id}`}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: space.xs, minHeight: 32 }}
                >
                  <Ionicons name="trash-outline" size={14} color={t.fault} />
                  <Text size="meta" weight="medium" tone="fault">
                    {tr('homeManagement.delete')}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </View>
        </PanelRow>
      </Panel>
    </Pressable>
  );

  /* ------------------------------------------------------------------ */
  /* Forma (dodavanje i izmjena)                                        */
  /* ------------------------------------------------------------------ */

  const formTitle = editingHome ? tr('homeManagement.editTitle') : tr('homeManagement.addTitle');
  const formSubmitting = createHomeMutation.isPending || updateHomeMutation.isPending;

  return (
    <Screen edges={['top']} testID="home-management-screen">
      <ScreenHeader
        title={tr('homeManagement.title')}
        subtitle={tr('homeManagement.subtitle')}
        onBack={() => (navigation as any).goBack()}
        backLabel={tr('common.back')}
        action={{
          icon: 'add',
          label: tr('homeManagement.addHome'),
          onPress: openAddForm,
          disabled: anyMutationPending,
        }}
        testID="home-management-header"
      />

      <ScreenBody
        testID="home-management-body"
        refreshControl={
          <RefreshControl
            refreshing={Boolean(isRefetching)}
            onRefresh={() => {
              void refetch();
            }}
          />
        }
      >
        {isLoading ? (
          <SkeletonRows count={3} />
        ) : isError ? (
          <Panel testID="home-management-error">
            <View style={{ gap: space.sm, alignItems: 'center' }}>
              <Ionicons name="alert-circle-outline" size={24} color={t.fault} />
              <Text size="bodyLg" weight="medium" align="center">
                {tr('homeManagement.loadErrorTitle')}
              </Text>
              <MonoMeta style={{ textAlign: 'center' }}>
                {error instanceof Error ? error.message : tr('homeManagement.loadErrorBody')}
              </MonoMeta>
              <Button
                label={tr('homeManagement.retry')}
                variant="secondary"
                onPress={() => void refetch()}
              />
            </View>
          </Panel>
        ) : homes.length === 0 ? (
          <EmptyState
            icon="home-outline"
            title={tr('homeManagement.noHomesTitle')}
            message={tr('homeManagement.noHomesBody')}
            action={{ label: tr('homeManagement.addHome'), onPress: openAddForm }}
          />
        ) : (
          <View style={{ gap: space.sm }}>
            {(homes as unknown as HomeProfile[]).map((home) => (
              <HomeCard key={home.id} home={home} />
            ))}
          </View>
        )}
      </ScreenBody>

      {/*
        Jedan `Sheet` za oba režima. Prije su bila dva `Modal`-a sa `maxHeight
        90%` i `ScrollView`-om unutra — bez zaglavlja koje se vidi kad se
        skrola i bez ijedne poruke o grešci u formi.
      */}
      <Sheet
        isOpen={showForm}
        onClose={closeForm}
        title={formTitle}
        closeLabel={tr('common.close')}
        snapPoints={['70%', '92%']}
        scrollable
        testID="home-form-sheet"
      >
        <View style={{ gap: space.lg }}>
          {formError ? (
            <InlineBanner tone="fault" title={formError} testID="home-form-error" />
          ) : null}

          <MonoLabel>{tr('homeManagement.sectionBasic')}</MonoLabel>
          <Field
            label={tr('homeManagement.fieldHomeName')}
            value={formData.homeName}
            onChangeText={(text) => setFormData({ ...formData, homeName: text })}
            placeholder={tr('homeProfile.form.homeName')}
            autoCapitalize="words"
            testID="home-form-name"
          />
          <Field
            label={tr('homeManagement.fieldLocation')}
            value={formData.location}
            onChangeText={(text) => setFormData({ ...formData, location: text })}
            placeholder={tr('homeProfile.form.location')}
            testID="home-form-location"
          />

          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <NumberField
                label={tr('homeManagement.fieldFloorArea')}
                value={formData.floorArea}
                onChangeValue={(value) => setFormData({ ...formData, floorArea: value })}
                testID="home-form-floor-area"
                required
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <NumberField
                label={tr('homeManagement.fieldCeilingHeight')}
                value={formData.ceilingHeight}
                onChangeValue={(value) => setFormData({ ...formData, ceilingHeight: value })}
                testID="home-form-ceiling"
              />
            </View>
          </View>

          <View style={{ flexDirection: 'row', gap: space.sm }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <NumberField
                label={tr('homeManagement.fieldResidents')}
                value={formData.numberOfResidents}
                onChangeValue={(value) =>
                  setFormData({ ...formData, numberOfResidents: Math.round(value) })
                }
                testID="home-form-residents"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <NumberField
                label={tr('homeManagement.fieldBuiltYear')}
                value={formData.constructionYear}
                onChangeValue={(value) =>
                  setFormData({ ...formData, constructionYear: Math.round(value) })
                }
                testID="home-form-year"
              />
            </View>
          </View>

          <MonoLabel>{tr('homeManagement.sectionBuilding')}</MonoLabel>
          <ChoiceField
            label={tr('homeManagement.fieldInsulationType')}
            required
            value={formData.insulationType}
            onChange={(next) =>
              setFormData({ ...formData, insulationType: next as InsulationType })
            }
            options={INSULATION_TYPE_OPTIONS.map((option) => ({
              value: option.value,
              label: tr(`homeProfile.insulation.${INSULATION_LABEL_KEY[option.value]}`),
            }))}
            testID="home-form-insulation"
          />
          <ChoiceField
            label={tr('homeManagement.fieldInsulationThickness')}
            required
            value={String(formData.insulationThickness)}
            onChange={(next) =>
              setFormData({ ...formData, insulationThickness: Number.parseInt(next, 10) })
            }
            options={INSULATION_THICKNESS_OPTIONS.map((cm) => ({
              value: String(cm),
              label: `${cm} cm`,
            }))}
            testID="home-form-thickness"
          />
          <ChoiceField
            label={tr('homeManagement.fieldWindowType')}
            required
            value={formData.windowType}
            onChange={(next) => setFormData({ ...formData, windowType: next as WindowType })}
            options={WINDOW_TYPE_OPTIONS.map((option) => ({
              value: option.value,
              label: tr(`homeProfile.window.${WINDOW_LABEL_KEY[option.value]}`),
            }))}
            testID="home-form-window"
          />

          <MonoLabel>{tr('homeManagement.sectionHeating')}</MonoLabel>
          <ChoiceField
            label={tr('homeManagement.fieldHeatingType')}
            required
            value={formData.heatingType}
            onChange={(next) => setFormData({ ...formData, heatingType: next as HeatingType })}
            options={HEATING_TYPE_OPTIONS.map((option) => ({
              value: option.value,
              label: tr(`homeProfile.heatingType.${HEATING_LABEL_KEY[option.value]}`),
            }))}
            testID="home-form-heating"
          />
          <ChoiceField
            label={tr('homeManagement.fieldSeasonMode')}
            required
            value={formData.seasonMode}
            onChange={(next) => setFormData({ ...formData, seasonMode: next as SeasonMode })}
            options={SEASON_MODE_OPTIONS.map((option) => ({
              value: option.value,
              label: tr(`homeProfile.seasonMode.${SEASON_LABEL_KEY[option.value]}`),
            }))}
            testID="home-form-season"
          />
          <Toggle
            label={tr('homeManagement.floorHeating')}
            value={formData.hasFloorHeating}
            onChange={(next) => setFormData({ ...formData, hasFloorHeating: next })}
            testID="home-form-floor-heating"
          />
          {/*
            Odabir kotla je trostepen (`25` §5.1): marka → porodica → snaga.
            Slobodan tekst je uklonjen jer se iz naziva modela ne može znati
            jesu li grijanje i PTV odvojena podešavanja — a o tome zavisi smije
            li aplikacija savjetovati snižavanje polazne.
          */}
          <ChoiceField
            label={tr('homeManagement.fieldBoilerBrand')}
            value={boilerBrand}
            onChange={(next) => {
              setFormData({
                ...formData,
                boilerCatalogId: '',
                boilerOutputKw: null,
              });
              setBoilerBrandOverride(next);
            }}
            options={brandChoices(catalog, tr('homeManagement.boilerNone'))}
            testID="home-form-boiler-brand"
          />
          <ChoiceField
            label={tr('homeManagement.fieldBoilerModel')}
            value={formData.boilerCatalogId}
            onChange={(next) =>
              setFormData({
                ...formData,
                boilerCatalogId: next,
                // Snaga pripada porodici: mijenja se zajedno sa njom.
                boilerOutputKw: null,
              })
            }
            options={familyChoices(
              catalog,
              boilerBrand,
              tr('homeManagement.boilerNone'),
            )}
            testID="home-form-boiler"
          />
          {outputChoices(catalog, formData.boilerCatalogId, tr('homeManagement.boilerNone'))
            .length > 0 ? (
            <ChoiceField
              label={tr('homeManagement.fieldBoilerOutput')}
              value={formData.boilerOutputKw == null ? '' : String(formData.boilerOutputKw)}
              onChange={(next) =>
                setFormData({
                  ...formData,
                  boilerOutputKw: next === '' ? null : Number.parseInt(next, 10),
                })
              }
              options={outputChoices(
                catalog,
                formData.boilerCatalogId,
                tr('homeManagement.boilerNone'),
              )}
              testID="home-form-boiler-output"
            />
          ) : null}
          <Text size="label" tone="muted">
            {selectionHint(catalog, formData.boilerCatalogId)}
          </Text>
          {!isKnownFamilyId(catalog, formData.boilerCatalogId) &&
          formData.boilerCatalogId !== '' ? (
            <InlineBanner
              tone="warn"
              title={tr('homeManagement.boilerStale')}
              message={formData.boilerCatalogId}
            />
          ) : null}
          {formData.boilerCatalogId === '' && formData.boilerModel ? (
            <Text size="label" tone="muted">
              {tr('homeManagement.boilerLegacy', { model: formData.boilerModel })}
            </Text>
          ) : null}
          {/*
            Najviša polazna (`19` §2): polje samo sužava 30–55. Prazno = granica
            kotla — nikad 55 unaprijed, jer bi upisana vrijednost izgledala kao
            korisnikov podatak.
          */}
          <ChoiceField
            label={tr('homeManagement.fieldMaxHeatingFlow')}
            value={
              formData.maxHeatingFlowC == null
                ? ''
                : String(formData.maxHeatingFlowC)
            }
            onChange={(next) =>
              setFormData({
                ...formData,
                maxHeatingFlowC: next === '' ? null : Number.parseInt(next, 10),
              })
            }
            options={[
              { value: '', label: tr('homeManagement.maxFlowUnset') },
              ...[30, 35, 40, 45, 50, 55].map((value) => ({
                value: String(value),
                label: `${value} °C`,
              })),
            ]}
            testID="home-form-max-flow"
          />

          <MonoLabel>{tr('homeManagement.sectionTemperatures')}</MonoLabel>
          <SliderField
            label={tr('homeManagement.tempMorning')}
            value={formData.targetMorningTemp}
            min={5}
            max={30}
            step={0.5}
            unit="°C"
            onChange={(value) => setFormData({ ...formData, targetMorningTemp: value })}
            testID="home-form-temp-morning"
          />
          <SliderField
            label={tr('homeManagement.tempDay')}
            value={formData.targetDayTemp}
            min={5}
            max={30}
            step={0.5}
            unit="°C"
            onChange={(value) => setFormData({ ...formData, targetDayTemp: value })}
            testID="home-form-temp-day"
          />
          <SliderField
            label={tr('homeManagement.tempNight')}
            value={formData.targetNightTemp}
            min={5}
            max={30}
            step={0.5}
            unit="°C"
            onChange={(value) => setFormData({ ...formData, targetNightTemp: value })}
            testID="home-form-temp-night"
          />

          <View style={{ gap: space.sm, marginTop: space.sm }}>
            <Button
              label={editingHome ? tr('homeManagement.save') : tr('homeManagement.addHome')}
              variant="primary"
              block
              onPress={submitForm}
              loading={formSubmitting}
              disabled={formSubmitting}
              style={{ minHeight: 52 }}
              testID="home-form-submit"
            />
            <Button
              label={tr('homeManagement.cancel')}
              variant="ghost"
              block
              onPress={closeForm}
              disabled={formSubmitting}
              testID="home-form-cancel"
            />
          </View>
        </View>
      </Sheet>
    </Screen>
  );
};

export const HomeManagementScreen = HomeManagementScreenContent;
