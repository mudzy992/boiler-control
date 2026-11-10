import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import {
  BOILER_FAMILIES,
  ENVELOPE_MAX_C,
  ENVELOPE_MIN_C,
  findBoilerFamily,
  isFlowAdviceAllowed,
} from '../BoilerCatalog/boiler-catalog';
import { CreateHomeProfileDto } from './dto/create-home-profile.dto';
import { UpdateHomeProfileDto } from './dto/update-home-profile.dto';

@Injectable()
export class HomeProfileService {
  constructor(private prisma: PrismaService) {}

  async findAll(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { homeLocation: true, activeHomeProfileId: true },
    });

    const profiles = await this.prisma.homeProfile.findMany({
      where: { userId },
      include: {
        thermostatDevices: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    // MO2-20: GET is read-only. Keep the legacy "first profile is active"
    // view for older clients, but do not persist activeHomeProfileId here.
    // Persisting an active profile belongs to create/activate.
    const activeId = user?.activeHomeProfileId ?? profiles[0]?.id ?? null;

    return profiles.map((profile) => ({
      id: profile.id,
      userId: profile.userId,
      homeName: profile.homeName,
      floorArea: profile.floorArea,
      ceilingHeight: profile.ceilingHeight,
      insulationType: profile.insulationType,
      insulationThickness: profile.insulationThickness,
      windowType: profile.windowType,
      heatingType: profile.heatingType,
      constructionYear: profile.constructionYear,
      numberOfResidents: profile.numberOfResidents,
      boilerModel: profile.boilerModel,
      boilerCatalogId: profile.boilerCatalogId,
      boilerOutputKw: profile.boilerOutputKw,
      maxHeatingFlowC: profile.maxHeatingFlowC,
      minHeatingFlowC: profile.minHeatingFlowC,
      hasFloorHeating: profile.hasFloorHeating,
      targetMorningTemp: profile.targetMorningTemp,
      targetDayTemp: profile.targetDayTemp,
      targetNightTemp: profile.targetNightTemp,
      preferredScheduleNotes: profile.preferredScheduleNotes,
      learningOffset: profile.learningOffset,
      learningConfidence: profile.learningConfidence,
      seasonMode: profile.seasonMode,
      createdAt: profile.createdAt,
      updatedAt: profile.updatedAt,
      // Legacy mobile aliases are kept for installed clients. MO2-20 removes
      // invented placeholder text; missing location is null, not a string.
      isActive: profile.id === activeId,
      thermostats: profile.thermostatDevices.length,
      name: profile.homeName ?? null,
      location: profile.location ?? user?.homeLocation ?? null,
      thermostatDevices: profile.thermostatDevices,
    }));
  }

  async findActive(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeHomeProfileId: true, homeLocation: true },
    });

    let activeId = user?.activeHomeProfileId ?? null;
    if (!activeId) {
      const first = await this.prisma.homeProfile.findFirst({
        where: { userId },
      });
      activeId = first?.id ?? null;
    }

    if (!activeId) return null;

    const profile = await this.prisma.homeProfile.findUnique({
      where: { id: activeId },
      include: { thermostatDevices: true },
    });

    if (!profile) return null;

    return {
      ...profile,
      isActive: true,
      thermostats: profile.thermostatDevices.length,
      name: profile.homeName ?? null,
      location: profile.location ?? user?.homeLocation ?? null,
    };
  }

  async findOne(userId: number, id: number) {
    const profile = await this.prisma.homeProfile.findFirst({
      where: { id, userId },
      include: {
        thermostatDevices: true,
        intervalLearnings: true,
      },
    });

    if (!profile) throw new NotFoundException('HomeProfile not found');
    return profile;
  }

  /**
   * Katalog za odabir modela (`19` §1) — samo ono što klijent treba da
   * prikaže izbor i da objasni zašto za neke modele nema savjeta o snižavanju.
   */
  boilerCatalog() {
    return {
      version: 1,
      envelope: { minC: ENVELOPE_MIN_C, maxC: ENVELOPE_MAX_C },
      families: BOILER_FAMILIES.map((family) => ({
        id: family.id,
        brand: family.brand,
        family: family.family,
        variant: family.variant,
        outputsKw: family.outputsKw,
        dhw: family.dhw,
        specStatus: family.specStatus,
        separateHeatingDhwSettings: family.separateHeatingDhwSettings,
        flowAdviceAllowed: isFlowAdviceAllowed(family),
        heatingFlowMinC: family.heatingFlowMinC,
        heatingFlowMaxC: family.heatingFlowMaxC,
        notes: family.notes,
      })),
    };
  }

  /**
   * Provjera da je odabir kotla **stvarna kombinacija iz kataloga**, a ne dva
   * nezavisna polja koja se slučajno slažu.
   *
   * Zašto u servisu, a ne u DTO-u: pravilo je međupoljno (`boilerCatalogId` ×
   * `boilerOutputKw`), pa mu treba katalog. `class-validator` bi tražio da DTO
   * zna katalog — a tada bi isti podatak imao dva izvora.
   *
   * Tri ishoda, svaki namjeran:
   *   - porodica ne postoji → odbij (DTO to već hvata, ovo je druga brana);
   *   - porodica navodi snage, a snaga nije među njima → odbij, uz spisak;
   *   - porodica navodi snage, a snaga nije poslata → odbij, jer bi zapis
   *     izgledao kao da je snaga poznata;
   *   - porodica ne navodi snage (nepotvrđen model) → snaga mora ostati prazna.
   */
  private validateBoilerSelection(
    boilerCatalogId: string | null | undefined,
    boilerOutputKw: number | null | undefined,
  ): void {
    if (boilerCatalogId == null) {
      if (boilerOutputKw != null) {
        throw new BadRequestException(
          'boilerOutputKw bez boilerCatalogId ne opisuje nijedan uređaj',
        );
      }
      return;
    }

    const family = findBoilerFamily(boilerCatalogId);
    if (family == null) {
      throw new BadRequestException(
        `Nepoznat model iz kataloga: ${boilerCatalogId}`,
      );
    }

    const allowed = family.outputsKw;
    if (allowed == null || allowed.length === 0) {
      // Model bez potvrđenih snaga ne smije nositi snagu: broj bi izgledao
      // kao podatak proizvođača, a došao bi iz forme.
      if (boilerOutputKw != null) {
        throw new BadRequestException(
          `${family.id} nema potvrđene snage u katalogu — snaga se ne upisuje`,
        );
      }
      return;
    }

    if (boilerOutputKw == null) {
      throw new BadRequestException(
        `Za ${family.id} je potrebno odabrati snagu: ${allowed.join(', ')} kW`,
      );
    }

    if (!allowed.includes(boilerOutputKw)) {
      throw new BadRequestException(
        `Snaga ${boilerOutputKw} kW nije u katalogu za ${family.id}; ` +
          `dozvoljeno: ${allowed.join(', ')} kW`,
      );
    }
  }

  async create(userId: number, dto: CreateHomeProfileDto) {
    this.validateBoilerSelection(dto.boilerCatalogId, dto.boilerOutputKw);

    return await this.prisma.$transaction(async (tx) => {
      const profile = await tx.homeProfile.create({
        data: {
          homeName: dto.homeName ?? null,
          location: dto.location ?? null,
          floorArea: dto.floorArea,
          ceilingHeight: dto.ceilingHeight,
          insulationType: dto.insulationType,
          insulationThickness: dto.insulationThickness,
          windowType: dto.windowType,
          heatingType: dto.heatingType,
          constructionYear: dto.constructionYear,
          numberOfResidents: dto.numberOfResidents ?? null,
          boilerModel: dto.boilerModel ?? null,
          boilerCatalogId: dto.boilerCatalogId ?? null,
          boilerOutputKw: dto.boilerOutputKw ?? null,
          maxHeatingFlowC: dto.maxHeatingFlowC ?? null,
          minHeatingFlowC: dto.minHeatingFlowC ?? null,
          hasFloorHeating: dto.hasFloorHeating,
          targetMorningTemp: dto.targetMorningTemp,
          targetDayTemp: dto.targetDayTemp,
          targetNightTemp: dto.targetNightTemp,
          preferredScheduleNotes: dto.preferredScheduleNotes ?? null,
          seasonMode: dto.seasonMode ?? 'WINTER',
          userId,
        },
      });

      const user = await tx.user.findUnique({
        where: { id: userId },
        select: { activeHomeProfileId: true },
      });

      if (!user?.activeHomeProfileId) {
        await tx.user.update({
          where: { id: userId },
          data: { activeHomeProfileId: profile.id },
        });
      }

      return profile;
    });
  }

  async update(userId: number, id: number, dto: UpdateHomeProfileDto) {
    const existing = await this.findOne(userId, id);

    const updateData: any = {};

    if (dto.homeName !== undefined) updateData.homeName = dto.homeName ?? null;
    if (dto.location !== undefined) {
      const nextLocation = dto.location ?? null;
      updateData.location = nextLocation;
      // A changed text value is only a search hint, never a confirmed coordinate.
      if (nextLocation !== existing.location) {
        Object.assign(updateData, {
          weatherLatitude: null,
          weatherLongitude: null,
          weatherTimezone: null,
          weatherLocationProvider: null,
          weatherLocationProviderId: null,
          weatherLocationLabel: null,
          weatherLocationName: null,
          weatherLocationAdmin1: null,
          weatherLocationCountry: null,
          weatherLocationCountryCode: null,
          weatherLocationConfirmedAt: null,
        });
      }
    }
    if (dto.floorArea !== undefined) updateData.floorArea = dto.floorArea;
    if (dto.ceilingHeight !== undefined)
      updateData.ceilingHeight = dto.ceilingHeight;
    if (dto.insulationType !== undefined)
      updateData.insulationType = dto.insulationType;
    if (dto.insulationThickness !== undefined)
      updateData.insulationThickness = dto.insulationThickness;
    if (dto.windowType !== undefined) updateData.windowType = dto.windowType;
    if (dto.heatingType !== undefined) updateData.heatingType = dto.heatingType;
    if (dto.constructionYear !== undefined)
      updateData.constructionYear = dto.constructionYear;
    if (dto.numberOfResidents !== undefined)
      updateData.numberOfResidents = dto.numberOfResidents ?? null;
    if (dto.boilerModel !== undefined)
      updateData.boilerModel = dto.boilerModel ?? null;
    if (dto.boilerCatalogId !== undefined)
      updateData.boilerCatalogId = dto.boilerCatalogId ?? null;

    /*
     * Odabir kotla se provjerava kao **cjelina**, sa stanjem koje će ostati
     * poslije ovog zahtjeva. Inače bi se kroz dva poziva (`PATCH` snaga, pa
     * `PATCH` model) moglo doći u stanje koje nijedan pojedinačni zahtjev ne
     * dozvoljava — npr. 24 kW uz porodicu koja ima samo 28 i 30.
     */
    if (dto.boilerCatalogId !== undefined || dto.boilerOutputKw !== undefined) {
      const nextCatalogId =
        dto.boilerCatalogId !== undefined
          ? (dto.boilerCatalogId ?? null)
          : (existing.boilerCatalogId ?? null);
      let nextOutputKw =
        dto.boilerOutputKw !== undefined
          ? (dto.boilerOutputKw ?? null)
          : ((existing as { boilerOutputKw?: number | null }).boilerOutputKw ??
            null);

      // Promjena modela bez nove snage: stara snaga pripada starom uređaju.
      if (
        dto.boilerCatalogId !== undefined &&
        dto.boilerOutputKw === undefined &&
        nextCatalogId !== (existing.boilerCatalogId ?? null)
      ) {
        nextOutputKw = null;
      }

      this.validateBoilerSelection(nextCatalogId, nextOutputKw);
      updateData.boilerOutputKw = nextOutputKw;
    }
    if (dto.hasFloorHeating !== undefined)
      updateData.hasFloorHeating = dto.hasFloorHeating;
    if (dto.maxHeatingFlowC !== undefined)
      updateData.maxHeatingFlowC = dto.maxHeatingFlowC ?? null;
    if (dto.minHeatingFlowC !== undefined)
      updateData.minHeatingFlowC = dto.minHeatingFlowC ?? null;
    if (dto.targetMorningTemp !== undefined)
      updateData.targetMorningTemp = dto.targetMorningTemp;
    if (dto.targetDayTemp !== undefined)
      updateData.targetDayTemp = dto.targetDayTemp;
    if (dto.targetNightTemp !== undefined)
      updateData.targetNightTemp = dto.targetNightTemp;
    if (dto.preferredScheduleNotes !== undefined)
      updateData.preferredScheduleNotes = dto.preferredScheduleNotes ?? null;
    if (dto.seasonMode !== undefined) updateData.seasonMode = dto.seasonMode;

    return this.prisma.homeProfile.update({
      where: { id },
      data: updateData,
    });
  }

  async remove(userId: number, id: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { activeHomeProfileId: true },
    });

    if (user?.activeHomeProfileId === id) {
      throw new BadRequestException(
        'Cannot delete the active home. Switch to another home first.',
      );
    }

    await this.findOne(userId, id);

    return this.prisma.homeProfile.delete({
      where: { id },
    });
  }

  async activate(userId: number, id: number) {
    // Verify ownership
    await this.findOne(userId, id);

    await this.prisma.user.update({
      where: { id: userId },
      data: { activeHomeProfileId: id },
    });

    const profile = await this.prisma.homeProfile.findUnique({
      where: { id },
      include: {
        thermostatDevices: true,
      },
    });

    if (!profile) {
      throw new NotFoundException('HomeProfile not found');
    }

    return {
      ...profile,
      isActive: true,
      thermostats: profile.thermostatDevices.length,
      name: profile.homeName ?? null,
      location: profile.location ?? null,
    };
  }
}
