import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type HeatingEventModel = runtime.Types.Result.DefaultSelection<Prisma.$HeatingEventPayload>;
export type AggregateHeatingEvent = {
    _count: HeatingEventCountAggregateOutputType | null;
    _avg: HeatingEventAvgAggregateOutputType | null;
    _sum: HeatingEventSumAggregateOutputType | null;
    _min: HeatingEventMinAggregateOutputType | null;
    _max: HeatingEventMaxAggregateOutputType | null;
};
export type HeatingEventAvgAggregateOutputType = {
    id: number | null;
    deviceId: number | null;
    currentTemp: number | null;
    targetTemp: number | null;
};
export type HeatingEventSumAggregateOutputType = {
    id: number | null;
    deviceId: number | null;
    currentTemp: number | null;
    targetTemp: number | null;
};
export type HeatingEventMinAggregateOutputType = {
    id: number | null;
    deviceId: number | null;
    timestampStart: Date | null;
    timestampEnd: Date | null;
    currentTemp: number | null;
    targetTemp: number | null;
    hvacAction: string | null;
    source: string | null;
    createdAt: Date | null;
};
export type HeatingEventMaxAggregateOutputType = {
    id: number | null;
    deviceId: number | null;
    timestampStart: Date | null;
    timestampEnd: Date | null;
    currentTemp: number | null;
    targetTemp: number | null;
    hvacAction: string | null;
    source: string | null;
    createdAt: Date | null;
};
export type HeatingEventCountAggregateOutputType = {
    id: number;
    deviceId: number;
    timestampStart: number;
    timestampEnd: number;
    currentTemp: number;
    targetTemp: number;
    hvacAction: number;
    source: number;
    createdAt: number;
    _all: number;
};
export type HeatingEventAvgAggregateInputType = {
    id?: true;
    deviceId?: true;
    currentTemp?: true;
    targetTemp?: true;
};
export type HeatingEventSumAggregateInputType = {
    id?: true;
    deviceId?: true;
    currentTemp?: true;
    targetTemp?: true;
};
export type HeatingEventMinAggregateInputType = {
    id?: true;
    deviceId?: true;
    timestampStart?: true;
    timestampEnd?: true;
    currentTemp?: true;
    targetTemp?: true;
    hvacAction?: true;
    source?: true;
    createdAt?: true;
};
export type HeatingEventMaxAggregateInputType = {
    id?: true;
    deviceId?: true;
    timestampStart?: true;
    timestampEnd?: true;
    currentTemp?: true;
    targetTemp?: true;
    hvacAction?: true;
    source?: true;
    createdAt?: true;
};
export type HeatingEventCountAggregateInputType = {
    id?: true;
    deviceId?: true;
    timestampStart?: true;
    timestampEnd?: true;
    currentTemp?: true;
    targetTemp?: true;
    hvacAction?: true;
    source?: true;
    createdAt?: true;
    _all?: true;
};
export type HeatingEventAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HeatingEventWhereInput;
    orderBy?: Prisma.HeatingEventOrderByWithRelationInput | Prisma.HeatingEventOrderByWithRelationInput[];
    cursor?: Prisma.HeatingEventWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | HeatingEventCountAggregateInputType;
    _avg?: HeatingEventAvgAggregateInputType;
    _sum?: HeatingEventSumAggregateInputType;
    _min?: HeatingEventMinAggregateInputType;
    _max?: HeatingEventMaxAggregateInputType;
};
export type GetHeatingEventAggregateType<T extends HeatingEventAggregateArgs> = {
    [P in keyof T & keyof AggregateHeatingEvent]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateHeatingEvent[P]> : Prisma.GetScalarType<T[P], AggregateHeatingEvent[P]>;
};
export type HeatingEventGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HeatingEventWhereInput;
    orderBy?: Prisma.HeatingEventOrderByWithAggregationInput | Prisma.HeatingEventOrderByWithAggregationInput[];
    by: Prisma.HeatingEventScalarFieldEnum[] | Prisma.HeatingEventScalarFieldEnum;
    having?: Prisma.HeatingEventScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: HeatingEventCountAggregateInputType | true;
    _avg?: HeatingEventAvgAggregateInputType;
    _sum?: HeatingEventSumAggregateInputType;
    _min?: HeatingEventMinAggregateInputType;
    _max?: HeatingEventMaxAggregateInputType;
};
export type HeatingEventGroupByOutputType = {
    id: number;
    deviceId: number;
    timestampStart: Date;
    timestampEnd: Date | null;
    currentTemp: number;
    targetTemp: number;
    hvacAction: string;
    source: string;
    createdAt: Date;
    _count: HeatingEventCountAggregateOutputType | null;
    _avg: HeatingEventAvgAggregateOutputType | null;
    _sum: HeatingEventSumAggregateOutputType | null;
    _min: HeatingEventMinAggregateOutputType | null;
    _max: HeatingEventMaxAggregateOutputType | null;
};
type GetHeatingEventGroupByPayload<T extends HeatingEventGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<HeatingEventGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof HeatingEventGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], HeatingEventGroupByOutputType[P]> : Prisma.GetScalarType<T[P], HeatingEventGroupByOutputType[P]>;
}>>;
export type HeatingEventWhereInput = {
    AND?: Prisma.HeatingEventWhereInput | Prisma.HeatingEventWhereInput[];
    OR?: Prisma.HeatingEventWhereInput[];
    NOT?: Prisma.HeatingEventWhereInput | Prisma.HeatingEventWhereInput[];
    id?: Prisma.IntFilter<"HeatingEvent"> | number;
    deviceId?: Prisma.IntFilter<"HeatingEvent"> | number;
    timestampStart?: Prisma.DateTimeFilter<"HeatingEvent"> | Date | string;
    timestampEnd?: Prisma.DateTimeNullableFilter<"HeatingEvent"> | Date | string | null;
    currentTemp?: Prisma.FloatFilter<"HeatingEvent"> | number;
    targetTemp?: Prisma.FloatFilter<"HeatingEvent"> | number;
    hvacAction?: Prisma.StringFilter<"HeatingEvent"> | string;
    source?: Prisma.StringFilter<"HeatingEvent"> | string;
    createdAt?: Prisma.DateTimeFilter<"HeatingEvent"> | Date | string;
    thermostat?: Prisma.XOR<Prisma.ThermostatDeviceScalarRelationFilter, Prisma.ThermostatDeviceWhereInput>;
};
export type HeatingEventOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    timestampStart?: Prisma.SortOrder;
    timestampEnd?: Prisma.SortOrderInput | Prisma.SortOrder;
    currentTemp?: Prisma.SortOrder;
    targetTemp?: Prisma.SortOrder;
    hvacAction?: Prisma.SortOrder;
    source?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    thermostat?: Prisma.ThermostatDeviceOrderByWithRelationInput;
    _relevance?: Prisma.HeatingEventOrderByRelevanceInput;
};
export type HeatingEventWhereUniqueInput = Prisma.AtLeast<{
    id?: number;
    AND?: Prisma.HeatingEventWhereInput | Prisma.HeatingEventWhereInput[];
    OR?: Prisma.HeatingEventWhereInput[];
    NOT?: Prisma.HeatingEventWhereInput | Prisma.HeatingEventWhereInput[];
    deviceId?: Prisma.IntFilter<"HeatingEvent"> | number;
    timestampStart?: Prisma.DateTimeFilter<"HeatingEvent"> | Date | string;
    timestampEnd?: Prisma.DateTimeNullableFilter<"HeatingEvent"> | Date | string | null;
    currentTemp?: Prisma.FloatFilter<"HeatingEvent"> | number;
    targetTemp?: Prisma.FloatFilter<"HeatingEvent"> | number;
    hvacAction?: Prisma.StringFilter<"HeatingEvent"> | string;
    source?: Prisma.StringFilter<"HeatingEvent"> | string;
    createdAt?: Prisma.DateTimeFilter<"HeatingEvent"> | Date | string;
    thermostat?: Prisma.XOR<Prisma.ThermostatDeviceScalarRelationFilter, Prisma.ThermostatDeviceWhereInput>;
}, "id">;
export type HeatingEventOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    timestampStart?: Prisma.SortOrder;
    timestampEnd?: Prisma.SortOrderInput | Prisma.SortOrder;
    currentTemp?: Prisma.SortOrder;
    targetTemp?: Prisma.SortOrder;
    hvacAction?: Prisma.SortOrder;
    source?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    _count?: Prisma.HeatingEventCountOrderByAggregateInput;
    _avg?: Prisma.HeatingEventAvgOrderByAggregateInput;
    _max?: Prisma.HeatingEventMaxOrderByAggregateInput;
    _min?: Prisma.HeatingEventMinOrderByAggregateInput;
    _sum?: Prisma.HeatingEventSumOrderByAggregateInput;
};
export type HeatingEventScalarWhereWithAggregatesInput = {
    AND?: Prisma.HeatingEventScalarWhereWithAggregatesInput | Prisma.HeatingEventScalarWhereWithAggregatesInput[];
    OR?: Prisma.HeatingEventScalarWhereWithAggregatesInput[];
    NOT?: Prisma.HeatingEventScalarWhereWithAggregatesInput | Prisma.HeatingEventScalarWhereWithAggregatesInput[];
    id?: Prisma.IntWithAggregatesFilter<"HeatingEvent"> | number;
    deviceId?: Prisma.IntWithAggregatesFilter<"HeatingEvent"> | number;
    timestampStart?: Prisma.DateTimeWithAggregatesFilter<"HeatingEvent"> | Date | string;
    timestampEnd?: Prisma.DateTimeNullableWithAggregatesFilter<"HeatingEvent"> | Date | string | null;
    currentTemp?: Prisma.FloatWithAggregatesFilter<"HeatingEvent"> | number;
    targetTemp?: Prisma.FloatWithAggregatesFilter<"HeatingEvent"> | number;
    hvacAction?: Prisma.StringWithAggregatesFilter<"HeatingEvent"> | string;
    source?: Prisma.StringWithAggregatesFilter<"HeatingEvent"> | string;
    createdAt?: Prisma.DateTimeWithAggregatesFilter<"HeatingEvent"> | Date | string;
};
export type HeatingEventCreateInput = {
    timestampStart: Date | string;
    timestampEnd?: Date | string | null;
    currentTemp: number;
    targetTemp: number;
    hvacAction: string;
    source: string;
    createdAt?: Date | string;
    thermostat: Prisma.ThermostatDeviceCreateNestedOneWithoutHeatingEventsInput;
};
export type HeatingEventUncheckedCreateInput = {
    id?: number;
    deviceId: number;
    timestampStart: Date | string;
    timestampEnd?: Date | string | null;
    currentTemp: number;
    targetTemp: number;
    hvacAction: string;
    source: string;
    createdAt?: Date | string;
};
export type HeatingEventUpdateInput = {
    timestampStart?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    timestampEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    currentTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    targetTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    hvacAction?: Prisma.StringFieldUpdateOperationsInput | string;
    source?: Prisma.StringFieldUpdateOperationsInput | string;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    thermostat?: Prisma.ThermostatDeviceUpdateOneRequiredWithoutHeatingEventsNestedInput;
};
export type HeatingEventUncheckedUpdateInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    deviceId?: Prisma.IntFieldUpdateOperationsInput | number;
    timestampStart?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    timestampEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    currentTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    targetTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    hvacAction?: Prisma.StringFieldUpdateOperationsInput | string;
    source?: Prisma.StringFieldUpdateOperationsInput | string;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingEventCreateManyInput = {
    id?: number;
    deviceId: number;
    timestampStart: Date | string;
    timestampEnd?: Date | string | null;
    currentTemp: number;
    targetTemp: number;
    hvacAction: string;
    source: string;
    createdAt?: Date | string;
};
export type HeatingEventUpdateManyMutationInput = {
    timestampStart?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    timestampEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    currentTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    targetTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    hvacAction?: Prisma.StringFieldUpdateOperationsInput | string;
    source?: Prisma.StringFieldUpdateOperationsInput | string;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingEventUncheckedUpdateManyInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    deviceId?: Prisma.IntFieldUpdateOperationsInput | number;
    timestampStart?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    timestampEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    currentTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    targetTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    hvacAction?: Prisma.StringFieldUpdateOperationsInput | string;
    source?: Prisma.StringFieldUpdateOperationsInput | string;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingEventListRelationFilter = {
    every?: Prisma.HeatingEventWhereInput;
    some?: Prisma.HeatingEventWhereInput;
    none?: Prisma.HeatingEventWhereInput;
};
export type HeatingEventOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type HeatingEventOrderByRelevanceInput = {
    fields: Prisma.HeatingEventOrderByRelevanceFieldEnum | Prisma.HeatingEventOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type HeatingEventCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    timestampStart?: Prisma.SortOrder;
    timestampEnd?: Prisma.SortOrder;
    currentTemp?: Prisma.SortOrder;
    targetTemp?: Prisma.SortOrder;
    hvacAction?: Prisma.SortOrder;
    source?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type HeatingEventAvgOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    currentTemp?: Prisma.SortOrder;
    targetTemp?: Prisma.SortOrder;
};
export type HeatingEventMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    timestampStart?: Prisma.SortOrder;
    timestampEnd?: Prisma.SortOrder;
    currentTemp?: Prisma.SortOrder;
    targetTemp?: Prisma.SortOrder;
    hvacAction?: Prisma.SortOrder;
    source?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type HeatingEventMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    timestampStart?: Prisma.SortOrder;
    timestampEnd?: Prisma.SortOrder;
    currentTemp?: Prisma.SortOrder;
    targetTemp?: Prisma.SortOrder;
    hvacAction?: Prisma.SortOrder;
    source?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type HeatingEventSumOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    currentTemp?: Prisma.SortOrder;
    targetTemp?: Prisma.SortOrder;
};
export type HeatingEventCreateNestedManyWithoutThermostatInput = {
    create?: Prisma.XOR<Prisma.HeatingEventCreateWithoutThermostatInput, Prisma.HeatingEventUncheckedCreateWithoutThermostatInput> | Prisma.HeatingEventCreateWithoutThermostatInput[] | Prisma.HeatingEventUncheckedCreateWithoutThermostatInput[];
    connectOrCreate?: Prisma.HeatingEventCreateOrConnectWithoutThermostatInput | Prisma.HeatingEventCreateOrConnectWithoutThermostatInput[];
    createMany?: Prisma.HeatingEventCreateManyThermostatInputEnvelope;
    connect?: Prisma.HeatingEventWhereUniqueInput | Prisma.HeatingEventWhereUniqueInput[];
};
export type HeatingEventUncheckedCreateNestedManyWithoutThermostatInput = {
    create?: Prisma.XOR<Prisma.HeatingEventCreateWithoutThermostatInput, Prisma.HeatingEventUncheckedCreateWithoutThermostatInput> | Prisma.HeatingEventCreateWithoutThermostatInput[] | Prisma.HeatingEventUncheckedCreateWithoutThermostatInput[];
    connectOrCreate?: Prisma.HeatingEventCreateOrConnectWithoutThermostatInput | Prisma.HeatingEventCreateOrConnectWithoutThermostatInput[];
    createMany?: Prisma.HeatingEventCreateManyThermostatInputEnvelope;
    connect?: Prisma.HeatingEventWhereUniqueInput | Prisma.HeatingEventWhereUniqueInput[];
};
export type HeatingEventUpdateManyWithoutThermostatNestedInput = {
    create?: Prisma.XOR<Prisma.HeatingEventCreateWithoutThermostatInput, Prisma.HeatingEventUncheckedCreateWithoutThermostatInput> | Prisma.HeatingEventCreateWithoutThermostatInput[] | Prisma.HeatingEventUncheckedCreateWithoutThermostatInput[];
    connectOrCreate?: Prisma.HeatingEventCreateOrConnectWithoutThermostatInput | Prisma.HeatingEventCreateOrConnectWithoutThermostatInput[];
    upsert?: Prisma.HeatingEventUpsertWithWhereUniqueWithoutThermostatInput | Prisma.HeatingEventUpsertWithWhereUniqueWithoutThermostatInput[];
    createMany?: Prisma.HeatingEventCreateManyThermostatInputEnvelope;
    set?: Prisma.HeatingEventWhereUniqueInput | Prisma.HeatingEventWhereUniqueInput[];
    disconnect?: Prisma.HeatingEventWhereUniqueInput | Prisma.HeatingEventWhereUniqueInput[];
    delete?: Prisma.HeatingEventWhereUniqueInput | Prisma.HeatingEventWhereUniqueInput[];
    connect?: Prisma.HeatingEventWhereUniqueInput | Prisma.HeatingEventWhereUniqueInput[];
    update?: Prisma.HeatingEventUpdateWithWhereUniqueWithoutThermostatInput | Prisma.HeatingEventUpdateWithWhereUniqueWithoutThermostatInput[];
    updateMany?: Prisma.HeatingEventUpdateManyWithWhereWithoutThermostatInput | Prisma.HeatingEventUpdateManyWithWhereWithoutThermostatInput[];
    deleteMany?: Prisma.HeatingEventScalarWhereInput | Prisma.HeatingEventScalarWhereInput[];
};
export type HeatingEventUncheckedUpdateManyWithoutThermostatNestedInput = {
    create?: Prisma.XOR<Prisma.HeatingEventCreateWithoutThermostatInput, Prisma.HeatingEventUncheckedCreateWithoutThermostatInput> | Prisma.HeatingEventCreateWithoutThermostatInput[] | Prisma.HeatingEventUncheckedCreateWithoutThermostatInput[];
    connectOrCreate?: Prisma.HeatingEventCreateOrConnectWithoutThermostatInput | Prisma.HeatingEventCreateOrConnectWithoutThermostatInput[];
    upsert?: Prisma.HeatingEventUpsertWithWhereUniqueWithoutThermostatInput | Prisma.HeatingEventUpsertWithWhereUniqueWithoutThermostatInput[];
    createMany?: Prisma.HeatingEventCreateManyThermostatInputEnvelope;
    set?: Prisma.HeatingEventWhereUniqueInput | Prisma.HeatingEventWhereUniqueInput[];
    disconnect?: Prisma.HeatingEventWhereUniqueInput | Prisma.HeatingEventWhereUniqueInput[];
    delete?: Prisma.HeatingEventWhereUniqueInput | Prisma.HeatingEventWhereUniqueInput[];
    connect?: Prisma.HeatingEventWhereUniqueInput | Prisma.HeatingEventWhereUniqueInput[];
    update?: Prisma.HeatingEventUpdateWithWhereUniqueWithoutThermostatInput | Prisma.HeatingEventUpdateWithWhereUniqueWithoutThermostatInput[];
    updateMany?: Prisma.HeatingEventUpdateManyWithWhereWithoutThermostatInput | Prisma.HeatingEventUpdateManyWithWhereWithoutThermostatInput[];
    deleteMany?: Prisma.HeatingEventScalarWhereInput | Prisma.HeatingEventScalarWhereInput[];
};
export type HeatingEventCreateWithoutThermostatInput = {
    timestampStart: Date | string;
    timestampEnd?: Date | string | null;
    currentTemp: number;
    targetTemp: number;
    hvacAction: string;
    source: string;
    createdAt?: Date | string;
};
export type HeatingEventUncheckedCreateWithoutThermostatInput = {
    id?: number;
    timestampStart: Date | string;
    timestampEnd?: Date | string | null;
    currentTemp: number;
    targetTemp: number;
    hvacAction: string;
    source: string;
    createdAt?: Date | string;
};
export type HeatingEventCreateOrConnectWithoutThermostatInput = {
    where: Prisma.HeatingEventWhereUniqueInput;
    create: Prisma.XOR<Prisma.HeatingEventCreateWithoutThermostatInput, Prisma.HeatingEventUncheckedCreateWithoutThermostatInput>;
};
export type HeatingEventCreateManyThermostatInputEnvelope = {
    data: Prisma.HeatingEventCreateManyThermostatInput | Prisma.HeatingEventCreateManyThermostatInput[];
    skipDuplicates?: boolean;
};
export type HeatingEventUpsertWithWhereUniqueWithoutThermostatInput = {
    where: Prisma.HeatingEventWhereUniqueInput;
    update: Prisma.XOR<Prisma.HeatingEventUpdateWithoutThermostatInput, Prisma.HeatingEventUncheckedUpdateWithoutThermostatInput>;
    create: Prisma.XOR<Prisma.HeatingEventCreateWithoutThermostatInput, Prisma.HeatingEventUncheckedCreateWithoutThermostatInput>;
};
export type HeatingEventUpdateWithWhereUniqueWithoutThermostatInput = {
    where: Prisma.HeatingEventWhereUniqueInput;
    data: Prisma.XOR<Prisma.HeatingEventUpdateWithoutThermostatInput, Prisma.HeatingEventUncheckedUpdateWithoutThermostatInput>;
};
export type HeatingEventUpdateManyWithWhereWithoutThermostatInput = {
    where: Prisma.HeatingEventScalarWhereInput;
    data: Prisma.XOR<Prisma.HeatingEventUpdateManyMutationInput, Prisma.HeatingEventUncheckedUpdateManyWithoutThermostatInput>;
};
export type HeatingEventScalarWhereInput = {
    AND?: Prisma.HeatingEventScalarWhereInput | Prisma.HeatingEventScalarWhereInput[];
    OR?: Prisma.HeatingEventScalarWhereInput[];
    NOT?: Prisma.HeatingEventScalarWhereInput | Prisma.HeatingEventScalarWhereInput[];
    id?: Prisma.IntFilter<"HeatingEvent"> | number;
    deviceId?: Prisma.IntFilter<"HeatingEvent"> | number;
    timestampStart?: Prisma.DateTimeFilter<"HeatingEvent"> | Date | string;
    timestampEnd?: Prisma.DateTimeNullableFilter<"HeatingEvent"> | Date | string | null;
    currentTemp?: Prisma.FloatFilter<"HeatingEvent"> | number;
    targetTemp?: Prisma.FloatFilter<"HeatingEvent"> | number;
    hvacAction?: Prisma.StringFilter<"HeatingEvent"> | string;
    source?: Prisma.StringFilter<"HeatingEvent"> | string;
    createdAt?: Prisma.DateTimeFilter<"HeatingEvent"> | Date | string;
};
export type HeatingEventCreateManyThermostatInput = {
    id?: number;
    timestampStart: Date | string;
    timestampEnd?: Date | string | null;
    currentTemp: number;
    targetTemp: number;
    hvacAction: string;
    source: string;
    createdAt?: Date | string;
};
export type HeatingEventUpdateWithoutThermostatInput = {
    timestampStart?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    timestampEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    currentTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    targetTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    hvacAction?: Prisma.StringFieldUpdateOperationsInput | string;
    source?: Prisma.StringFieldUpdateOperationsInput | string;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingEventUncheckedUpdateWithoutThermostatInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    timestampStart?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    timestampEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    currentTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    targetTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    hvacAction?: Prisma.StringFieldUpdateOperationsInput | string;
    source?: Prisma.StringFieldUpdateOperationsInput | string;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingEventUncheckedUpdateManyWithoutThermostatInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    timestampStart?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    timestampEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    currentTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    targetTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    hvacAction?: Prisma.StringFieldUpdateOperationsInput | string;
    source?: Prisma.StringFieldUpdateOperationsInput | string;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingEventSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    deviceId?: boolean;
    timestampStart?: boolean;
    timestampEnd?: boolean;
    currentTemp?: boolean;
    targetTemp?: boolean;
    hvacAction?: boolean;
    source?: boolean;
    createdAt?: boolean;
    thermostat?: boolean | Prisma.ThermostatDeviceDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["heatingEvent"]>;
export type HeatingEventSelectScalar = {
    id?: boolean;
    deviceId?: boolean;
    timestampStart?: boolean;
    timestampEnd?: boolean;
    currentTemp?: boolean;
    targetTemp?: boolean;
    hvacAction?: boolean;
    source?: boolean;
    createdAt?: boolean;
};
export type HeatingEventOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "deviceId" | "timestampStart" | "timestampEnd" | "currentTemp" | "targetTemp" | "hvacAction" | "source" | "createdAt", ExtArgs["result"]["heatingEvent"]>;
export type HeatingEventInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    thermostat?: boolean | Prisma.ThermostatDeviceDefaultArgs<ExtArgs>;
};
export type $HeatingEventPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "HeatingEvent";
    objects: {
        thermostat: Prisma.$ThermostatDevicePayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: number;
        deviceId: number;
        timestampStart: Date;
        timestampEnd: Date | null;
        currentTemp: number;
        targetTemp: number;
        hvacAction: string;
        source: string;
        createdAt: Date;
    }, ExtArgs["result"]["heatingEvent"]>;
    composites: {};
};
export type HeatingEventGetPayload<S extends boolean | null | undefined | HeatingEventDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$HeatingEventPayload, S>;
export type HeatingEventCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<HeatingEventFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: HeatingEventCountAggregateInputType | true;
};
export interface HeatingEventDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['HeatingEvent'];
        meta: {
            name: 'HeatingEvent';
        };
    };
    findUnique<T extends HeatingEventFindUniqueArgs>(args: Prisma.SelectSubset<T, HeatingEventFindUniqueArgs<ExtArgs>>): Prisma.Prisma__HeatingEventClient<runtime.Types.Result.GetResult<Prisma.$HeatingEventPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends HeatingEventFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, HeatingEventFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__HeatingEventClient<runtime.Types.Result.GetResult<Prisma.$HeatingEventPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends HeatingEventFindFirstArgs>(args?: Prisma.SelectSubset<T, HeatingEventFindFirstArgs<ExtArgs>>): Prisma.Prisma__HeatingEventClient<runtime.Types.Result.GetResult<Prisma.$HeatingEventPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends HeatingEventFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, HeatingEventFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__HeatingEventClient<runtime.Types.Result.GetResult<Prisma.$HeatingEventPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends HeatingEventFindManyArgs>(args?: Prisma.SelectSubset<T, HeatingEventFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$HeatingEventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends HeatingEventCreateArgs>(args: Prisma.SelectSubset<T, HeatingEventCreateArgs<ExtArgs>>): Prisma.Prisma__HeatingEventClient<runtime.Types.Result.GetResult<Prisma.$HeatingEventPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends HeatingEventCreateManyArgs>(args?: Prisma.SelectSubset<T, HeatingEventCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends HeatingEventDeleteArgs>(args: Prisma.SelectSubset<T, HeatingEventDeleteArgs<ExtArgs>>): Prisma.Prisma__HeatingEventClient<runtime.Types.Result.GetResult<Prisma.$HeatingEventPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends HeatingEventUpdateArgs>(args: Prisma.SelectSubset<T, HeatingEventUpdateArgs<ExtArgs>>): Prisma.Prisma__HeatingEventClient<runtime.Types.Result.GetResult<Prisma.$HeatingEventPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends HeatingEventDeleteManyArgs>(args?: Prisma.SelectSubset<T, HeatingEventDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends HeatingEventUpdateManyArgs>(args: Prisma.SelectSubset<T, HeatingEventUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends HeatingEventUpsertArgs>(args: Prisma.SelectSubset<T, HeatingEventUpsertArgs<ExtArgs>>): Prisma.Prisma__HeatingEventClient<runtime.Types.Result.GetResult<Prisma.$HeatingEventPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends HeatingEventCountArgs>(args?: Prisma.Subset<T, HeatingEventCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], HeatingEventCountAggregateOutputType> : number>;
    aggregate<T extends HeatingEventAggregateArgs>(args: Prisma.Subset<T, HeatingEventAggregateArgs>): Prisma.PrismaPromise<GetHeatingEventAggregateType<T>>;
    groupBy<T extends HeatingEventGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: HeatingEventGroupByArgs['orderBy'];
    } : {
        orderBy?: HeatingEventGroupByArgs['orderBy'];
    }, OrderFields extends Prisma.ExcludeUnderscoreKeys<Prisma.Keys<Prisma.MaybeTupleToUnion<T['orderBy']>>>, ByFields extends Prisma.MaybeTupleToUnion<T['by']>, ByValid extends Prisma.Has<ByFields, OrderFields>, HavingFields extends Prisma.GetHavingFields<T['having']>, HavingValid extends Prisma.Has<ByFields, HavingFields>, ByEmpty extends T['by'] extends never[] ? Prisma.True : Prisma.False, InputErrors extends ByEmpty extends Prisma.True ? `Error: "by" must not be empty.` : HavingValid extends Prisma.False ? {
        [P in HavingFields]: P extends ByFields ? never : P extends string ? `Error: Field "${P}" used in "having" needs to be provided in "by".` : [
            Error,
            'Field ',
            P,
            ` in "having" needs to be provided in "by"`
        ];
    }[HavingFields] : 'take' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "take", you also need to provide "orderBy"' : 'skip' extends Prisma.Keys<T> ? 'orderBy' extends Prisma.Keys<T> ? ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields] : 'Error: If you provide "skip", you also need to provide "orderBy"' : ByValid extends Prisma.True ? {} : {
        [P in OrderFields]: P extends ByFields ? never : `Error: Field "${P}" in "orderBy" needs to be provided in "by"`;
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, HeatingEventGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetHeatingEventGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: HeatingEventFieldRefs;
}
export interface Prisma__HeatingEventClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    thermostat<T extends Prisma.ThermostatDeviceDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ThermostatDeviceDefaultArgs<ExtArgs>>): Prisma.Prisma__ThermostatDeviceClient<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface HeatingEventFieldRefs {
    readonly id: Prisma.FieldRef<"HeatingEvent", 'Int'>;
    readonly deviceId: Prisma.FieldRef<"HeatingEvent", 'Int'>;
    readonly timestampStart: Prisma.FieldRef<"HeatingEvent", 'DateTime'>;
    readonly timestampEnd: Prisma.FieldRef<"HeatingEvent", 'DateTime'>;
    readonly currentTemp: Prisma.FieldRef<"HeatingEvent", 'Float'>;
    readonly targetTemp: Prisma.FieldRef<"HeatingEvent", 'Float'>;
    readonly hvacAction: Prisma.FieldRef<"HeatingEvent", 'String'>;
    readonly source: Prisma.FieldRef<"HeatingEvent", 'String'>;
    readonly createdAt: Prisma.FieldRef<"HeatingEvent", 'DateTime'>;
}
export type HeatingEventFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingEventSelect<ExtArgs> | null;
    omit?: Prisma.HeatingEventOmit<ExtArgs> | null;
    include?: Prisma.HeatingEventInclude<ExtArgs> | null;
    where: Prisma.HeatingEventWhereUniqueInput;
};
export type HeatingEventFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingEventSelect<ExtArgs> | null;
    omit?: Prisma.HeatingEventOmit<ExtArgs> | null;
    include?: Prisma.HeatingEventInclude<ExtArgs> | null;
    where: Prisma.HeatingEventWhereUniqueInput;
};
export type HeatingEventFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingEventSelect<ExtArgs> | null;
    omit?: Prisma.HeatingEventOmit<ExtArgs> | null;
    include?: Prisma.HeatingEventInclude<ExtArgs> | null;
    where?: Prisma.HeatingEventWhereInput;
    orderBy?: Prisma.HeatingEventOrderByWithRelationInput | Prisma.HeatingEventOrderByWithRelationInput[];
    cursor?: Prisma.HeatingEventWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.HeatingEventScalarFieldEnum | Prisma.HeatingEventScalarFieldEnum[];
};
export type HeatingEventFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingEventSelect<ExtArgs> | null;
    omit?: Prisma.HeatingEventOmit<ExtArgs> | null;
    include?: Prisma.HeatingEventInclude<ExtArgs> | null;
    where?: Prisma.HeatingEventWhereInput;
    orderBy?: Prisma.HeatingEventOrderByWithRelationInput | Prisma.HeatingEventOrderByWithRelationInput[];
    cursor?: Prisma.HeatingEventWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.HeatingEventScalarFieldEnum | Prisma.HeatingEventScalarFieldEnum[];
};
export type HeatingEventFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingEventSelect<ExtArgs> | null;
    omit?: Prisma.HeatingEventOmit<ExtArgs> | null;
    include?: Prisma.HeatingEventInclude<ExtArgs> | null;
    where?: Prisma.HeatingEventWhereInput;
    orderBy?: Prisma.HeatingEventOrderByWithRelationInput | Prisma.HeatingEventOrderByWithRelationInput[];
    cursor?: Prisma.HeatingEventWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.HeatingEventScalarFieldEnum | Prisma.HeatingEventScalarFieldEnum[];
};
export type HeatingEventCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingEventSelect<ExtArgs> | null;
    omit?: Prisma.HeatingEventOmit<ExtArgs> | null;
    include?: Prisma.HeatingEventInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.HeatingEventCreateInput, Prisma.HeatingEventUncheckedCreateInput>;
};
export type HeatingEventCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.HeatingEventCreateManyInput | Prisma.HeatingEventCreateManyInput[];
    skipDuplicates?: boolean;
};
export type HeatingEventUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingEventSelect<ExtArgs> | null;
    omit?: Prisma.HeatingEventOmit<ExtArgs> | null;
    include?: Prisma.HeatingEventInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.HeatingEventUpdateInput, Prisma.HeatingEventUncheckedUpdateInput>;
    where: Prisma.HeatingEventWhereUniqueInput;
};
export type HeatingEventUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.HeatingEventUpdateManyMutationInput, Prisma.HeatingEventUncheckedUpdateManyInput>;
    where?: Prisma.HeatingEventWhereInput;
    limit?: number;
};
export type HeatingEventUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingEventSelect<ExtArgs> | null;
    omit?: Prisma.HeatingEventOmit<ExtArgs> | null;
    include?: Prisma.HeatingEventInclude<ExtArgs> | null;
    where: Prisma.HeatingEventWhereUniqueInput;
    create: Prisma.XOR<Prisma.HeatingEventCreateInput, Prisma.HeatingEventUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.HeatingEventUpdateInput, Prisma.HeatingEventUncheckedUpdateInput>;
};
export type HeatingEventDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingEventSelect<ExtArgs> | null;
    omit?: Prisma.HeatingEventOmit<ExtArgs> | null;
    include?: Prisma.HeatingEventInclude<ExtArgs> | null;
    where: Prisma.HeatingEventWhereUniqueInput;
};
export type HeatingEventDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HeatingEventWhereInput;
    limit?: number;
};
export type HeatingEventDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingEventSelect<ExtArgs> | null;
    omit?: Prisma.HeatingEventOmit<ExtArgs> | null;
    include?: Prisma.HeatingEventInclude<ExtArgs> | null;
};
export {};
