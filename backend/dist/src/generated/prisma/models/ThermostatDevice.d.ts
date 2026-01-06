import type * as runtime from "@prisma/client/runtime/client";
import type * as $Enums from "../enums.js";
import type * as Prisma from "../internal/prismaNamespace.js";
export type ThermostatDeviceModel = runtime.Types.Result.DefaultSelection<Prisma.$ThermostatDevicePayload>;
export type AggregateThermostatDevice = {
    _count: ThermostatDeviceCountAggregateOutputType | null;
    _avg: ThermostatDeviceAvgAggregateOutputType | null;
    _sum: ThermostatDeviceSumAggregateOutputType | null;
    _min: ThermostatDeviceMinAggregateOutputType | null;
    _max: ThermostatDeviceMaxAggregateOutputType | null;
};
export type ThermostatDeviceAvgAggregateOutputType = {
    id: number | null;
    userId: number | null;
    homeProfileId: number | null;
};
export type ThermostatDeviceSumAggregateOutputType = {
    id: number | null;
    userId: number | null;
    homeProfileId: number | null;
};
export type ThermostatDeviceMinAggregateOutputType = {
    id: number | null;
    userId: number | null;
    homeProfileId: number | null;
    vendor: string | null;
    deviceId: string | null;
    alias: string | null;
    lastSeen: Date | null;
    mode: $Enums.ThermostatMode | null;
    createdAt: Date | null;
    updatedAt: Date | null;
};
export type ThermostatDeviceMaxAggregateOutputType = {
    id: number | null;
    userId: number | null;
    homeProfileId: number | null;
    vendor: string | null;
    deviceId: string | null;
    alias: string | null;
    lastSeen: Date | null;
    mode: $Enums.ThermostatMode | null;
    createdAt: Date | null;
    updatedAt: Date | null;
};
export type ThermostatDeviceCountAggregateOutputType = {
    id: number;
    userId: number;
    homeProfileId: number;
    vendor: number;
    deviceId: number;
    alias: number;
    lastSeen: number;
    mode: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
};
export type ThermostatDeviceAvgAggregateInputType = {
    id?: true;
    userId?: true;
    homeProfileId?: true;
};
export type ThermostatDeviceSumAggregateInputType = {
    id?: true;
    userId?: true;
    homeProfileId?: true;
};
export type ThermostatDeviceMinAggregateInputType = {
    id?: true;
    userId?: true;
    homeProfileId?: true;
    vendor?: true;
    deviceId?: true;
    alias?: true;
    lastSeen?: true;
    mode?: true;
    createdAt?: true;
    updatedAt?: true;
};
export type ThermostatDeviceMaxAggregateInputType = {
    id?: true;
    userId?: true;
    homeProfileId?: true;
    vendor?: true;
    deviceId?: true;
    alias?: true;
    lastSeen?: true;
    mode?: true;
    createdAt?: true;
    updatedAt?: true;
};
export type ThermostatDeviceCountAggregateInputType = {
    id?: true;
    userId?: true;
    homeProfileId?: true;
    vendor?: true;
    deviceId?: true;
    alias?: true;
    lastSeen?: true;
    mode?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
};
export type ThermostatDeviceAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ThermostatDeviceWhereInput;
    orderBy?: Prisma.ThermostatDeviceOrderByWithRelationInput | Prisma.ThermostatDeviceOrderByWithRelationInput[];
    cursor?: Prisma.ThermostatDeviceWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | ThermostatDeviceCountAggregateInputType;
    _avg?: ThermostatDeviceAvgAggregateInputType;
    _sum?: ThermostatDeviceSumAggregateInputType;
    _min?: ThermostatDeviceMinAggregateInputType;
    _max?: ThermostatDeviceMaxAggregateInputType;
};
export type GetThermostatDeviceAggregateType<T extends ThermostatDeviceAggregateArgs> = {
    [P in keyof T & keyof AggregateThermostatDevice]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateThermostatDevice[P]> : Prisma.GetScalarType<T[P], AggregateThermostatDevice[P]>;
};
export type ThermostatDeviceGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ThermostatDeviceWhereInput;
    orderBy?: Prisma.ThermostatDeviceOrderByWithAggregationInput | Prisma.ThermostatDeviceOrderByWithAggregationInput[];
    by: Prisma.ThermostatDeviceScalarFieldEnum[] | Prisma.ThermostatDeviceScalarFieldEnum;
    having?: Prisma.ThermostatDeviceScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: ThermostatDeviceCountAggregateInputType | true;
    _avg?: ThermostatDeviceAvgAggregateInputType;
    _sum?: ThermostatDeviceSumAggregateInputType;
    _min?: ThermostatDeviceMinAggregateInputType;
    _max?: ThermostatDeviceMaxAggregateInputType;
};
export type ThermostatDeviceGroupByOutputType = {
    id: number;
    userId: number;
    homeProfileId: number;
    vendor: string;
    deviceId: string;
    alias: string | null;
    lastSeen: Date | null;
    mode: $Enums.ThermostatMode;
    createdAt: Date;
    updatedAt: Date;
    _count: ThermostatDeviceCountAggregateOutputType | null;
    _avg: ThermostatDeviceAvgAggregateOutputType | null;
    _sum: ThermostatDeviceSumAggregateOutputType | null;
    _min: ThermostatDeviceMinAggregateOutputType | null;
    _max: ThermostatDeviceMaxAggregateOutputType | null;
};
type GetThermostatDeviceGroupByPayload<T extends ThermostatDeviceGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<ThermostatDeviceGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof ThermostatDeviceGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], ThermostatDeviceGroupByOutputType[P]> : Prisma.GetScalarType<T[P], ThermostatDeviceGroupByOutputType[P]>;
}>>;
export type ThermostatDeviceWhereInput = {
    AND?: Prisma.ThermostatDeviceWhereInput | Prisma.ThermostatDeviceWhereInput[];
    OR?: Prisma.ThermostatDeviceWhereInput[];
    NOT?: Prisma.ThermostatDeviceWhereInput | Prisma.ThermostatDeviceWhereInput[];
    id?: Prisma.IntFilter<"ThermostatDevice"> | number;
    userId?: Prisma.IntFilter<"ThermostatDevice"> | number;
    homeProfileId?: Prisma.IntFilter<"ThermostatDevice"> | number;
    vendor?: Prisma.StringFilter<"ThermostatDevice"> | string;
    deviceId?: Prisma.StringFilter<"ThermostatDevice"> | string;
    alias?: Prisma.StringNullableFilter<"ThermostatDevice"> | string | null;
    lastSeen?: Prisma.DateTimeNullableFilter<"ThermostatDevice"> | Date | string | null;
    mode?: Prisma.EnumThermostatModeFilter<"ThermostatDevice"> | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFilter<"ThermostatDevice"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"ThermostatDevice"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
    homeProfile?: Prisma.XOR<Prisma.HomeProfileScalarRelationFilter, Prisma.HomeProfileWhereInput>;
    heatingEvents?: Prisma.HeatingEventListRelationFilter;
};
export type ThermostatDeviceOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    vendor?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    alias?: Prisma.SortOrderInput | Prisma.SortOrder;
    lastSeen?: Prisma.SortOrderInput | Prisma.SortOrder;
    mode?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    user?: Prisma.UserOrderByWithRelationInput;
    homeProfile?: Prisma.HomeProfileOrderByWithRelationInput;
    heatingEvents?: Prisma.HeatingEventOrderByRelationAggregateInput;
    _relevance?: Prisma.ThermostatDeviceOrderByRelevanceInput;
};
export type ThermostatDeviceWhereUniqueInput = Prisma.AtLeast<{
    id?: number;
    AND?: Prisma.ThermostatDeviceWhereInput | Prisma.ThermostatDeviceWhereInput[];
    OR?: Prisma.ThermostatDeviceWhereInput[];
    NOT?: Prisma.ThermostatDeviceWhereInput | Prisma.ThermostatDeviceWhereInput[];
    userId?: Prisma.IntFilter<"ThermostatDevice"> | number;
    homeProfileId?: Prisma.IntFilter<"ThermostatDevice"> | number;
    vendor?: Prisma.StringFilter<"ThermostatDevice"> | string;
    deviceId?: Prisma.StringFilter<"ThermostatDevice"> | string;
    alias?: Prisma.StringNullableFilter<"ThermostatDevice"> | string | null;
    lastSeen?: Prisma.DateTimeNullableFilter<"ThermostatDevice"> | Date | string | null;
    mode?: Prisma.EnumThermostatModeFilter<"ThermostatDevice"> | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFilter<"ThermostatDevice"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"ThermostatDevice"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
    homeProfile?: Prisma.XOR<Prisma.HomeProfileScalarRelationFilter, Prisma.HomeProfileWhereInput>;
    heatingEvents?: Prisma.HeatingEventListRelationFilter;
}, "id">;
export type ThermostatDeviceOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    vendor?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    alias?: Prisma.SortOrderInput | Prisma.SortOrder;
    lastSeen?: Prisma.SortOrderInput | Prisma.SortOrder;
    mode?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    _count?: Prisma.ThermostatDeviceCountOrderByAggregateInput;
    _avg?: Prisma.ThermostatDeviceAvgOrderByAggregateInput;
    _max?: Prisma.ThermostatDeviceMaxOrderByAggregateInput;
    _min?: Prisma.ThermostatDeviceMinOrderByAggregateInput;
    _sum?: Prisma.ThermostatDeviceSumOrderByAggregateInput;
};
export type ThermostatDeviceScalarWhereWithAggregatesInput = {
    AND?: Prisma.ThermostatDeviceScalarWhereWithAggregatesInput | Prisma.ThermostatDeviceScalarWhereWithAggregatesInput[];
    OR?: Prisma.ThermostatDeviceScalarWhereWithAggregatesInput[];
    NOT?: Prisma.ThermostatDeviceScalarWhereWithAggregatesInput | Prisma.ThermostatDeviceScalarWhereWithAggregatesInput[];
    id?: Prisma.IntWithAggregatesFilter<"ThermostatDevice"> | number;
    userId?: Prisma.IntWithAggregatesFilter<"ThermostatDevice"> | number;
    homeProfileId?: Prisma.IntWithAggregatesFilter<"ThermostatDevice"> | number;
    vendor?: Prisma.StringWithAggregatesFilter<"ThermostatDevice"> | string;
    deviceId?: Prisma.StringWithAggregatesFilter<"ThermostatDevice"> | string;
    alias?: Prisma.StringNullableWithAggregatesFilter<"ThermostatDevice"> | string | null;
    lastSeen?: Prisma.DateTimeNullableWithAggregatesFilter<"ThermostatDevice"> | Date | string | null;
    mode?: Prisma.EnumThermostatModeWithAggregatesFilter<"ThermostatDevice"> | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeWithAggregatesFilter<"ThermostatDevice"> | Date | string;
    updatedAt?: Prisma.DateTimeWithAggregatesFilter<"ThermostatDevice"> | Date | string;
};
export type ThermostatDeviceCreateInput = {
    vendor: string;
    deviceId: string;
    alias?: string | null;
    lastSeen?: Date | string | null;
    mode?: $Enums.ThermostatMode;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutThermostatDevicesInput;
    homeProfile: Prisma.HomeProfileCreateNestedOneWithoutThermostatDevicesInput;
    heatingEvents?: Prisma.HeatingEventCreateNestedManyWithoutThermostatInput;
};
export type ThermostatDeviceUncheckedCreateInput = {
    id?: number;
    userId: number;
    homeProfileId: number;
    vendor: string;
    deviceId: string;
    alias?: string | null;
    lastSeen?: Date | string | null;
    mode?: $Enums.ThermostatMode;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    heatingEvents?: Prisma.HeatingEventUncheckedCreateNestedManyWithoutThermostatInput;
};
export type ThermostatDeviceUpdateInput = {
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutThermostatDevicesNestedInput;
    homeProfile?: Prisma.HomeProfileUpdateOneRequiredWithoutThermostatDevicesNestedInput;
    heatingEvents?: Prisma.HeatingEventUpdateManyWithoutThermostatNestedInput;
};
export type ThermostatDeviceUncheckedUpdateInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    homeProfileId?: Prisma.IntFieldUpdateOperationsInput | number;
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    heatingEvents?: Prisma.HeatingEventUncheckedUpdateManyWithoutThermostatNestedInput;
};
export type ThermostatDeviceCreateManyInput = {
    id?: number;
    userId: number;
    homeProfileId: number;
    vendor: string;
    deviceId: string;
    alias?: string | null;
    lastSeen?: Date | string | null;
    mode?: $Enums.ThermostatMode;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};
export type ThermostatDeviceUpdateManyMutationInput = {
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ThermostatDeviceUncheckedUpdateManyInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    homeProfileId?: Prisma.IntFieldUpdateOperationsInput | number;
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ThermostatDeviceListRelationFilter = {
    every?: Prisma.ThermostatDeviceWhereInput;
    some?: Prisma.ThermostatDeviceWhereInput;
    none?: Prisma.ThermostatDeviceWhereInput;
};
export type ThermostatDeviceOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type ThermostatDeviceOrderByRelevanceInput = {
    fields: Prisma.ThermostatDeviceOrderByRelevanceFieldEnum | Prisma.ThermostatDeviceOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type ThermostatDeviceCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    vendor?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    alias?: Prisma.SortOrder;
    lastSeen?: Prisma.SortOrder;
    mode?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type ThermostatDeviceAvgOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
};
export type ThermostatDeviceMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    vendor?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    alias?: Prisma.SortOrder;
    lastSeen?: Prisma.SortOrder;
    mode?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type ThermostatDeviceMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    vendor?: Prisma.SortOrder;
    deviceId?: Prisma.SortOrder;
    alias?: Prisma.SortOrder;
    lastSeen?: Prisma.SortOrder;
    mode?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type ThermostatDeviceSumOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
};
export type ThermostatDeviceScalarRelationFilter = {
    is?: Prisma.ThermostatDeviceWhereInput;
    isNot?: Prisma.ThermostatDeviceWhereInput;
};
export type ThermostatDeviceCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutUserInput, Prisma.ThermostatDeviceUncheckedCreateWithoutUserInput> | Prisma.ThermostatDeviceCreateWithoutUserInput[] | Prisma.ThermostatDeviceUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ThermostatDeviceCreateOrConnectWithoutUserInput | Prisma.ThermostatDeviceCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.ThermostatDeviceCreateManyUserInputEnvelope;
    connect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
};
export type ThermostatDeviceUncheckedCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutUserInput, Prisma.ThermostatDeviceUncheckedCreateWithoutUserInput> | Prisma.ThermostatDeviceCreateWithoutUserInput[] | Prisma.ThermostatDeviceUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ThermostatDeviceCreateOrConnectWithoutUserInput | Prisma.ThermostatDeviceCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.ThermostatDeviceCreateManyUserInputEnvelope;
    connect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
};
export type ThermostatDeviceUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutUserInput, Prisma.ThermostatDeviceUncheckedCreateWithoutUserInput> | Prisma.ThermostatDeviceCreateWithoutUserInput[] | Prisma.ThermostatDeviceUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ThermostatDeviceCreateOrConnectWithoutUserInput | Prisma.ThermostatDeviceCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.ThermostatDeviceUpsertWithWhereUniqueWithoutUserInput | Prisma.ThermostatDeviceUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.ThermostatDeviceCreateManyUserInputEnvelope;
    set?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    disconnect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    delete?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    connect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    update?: Prisma.ThermostatDeviceUpdateWithWhereUniqueWithoutUserInput | Prisma.ThermostatDeviceUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.ThermostatDeviceUpdateManyWithWhereWithoutUserInput | Prisma.ThermostatDeviceUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.ThermostatDeviceScalarWhereInput | Prisma.ThermostatDeviceScalarWhereInput[];
};
export type ThermostatDeviceUncheckedUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutUserInput, Prisma.ThermostatDeviceUncheckedCreateWithoutUserInput> | Prisma.ThermostatDeviceCreateWithoutUserInput[] | Prisma.ThermostatDeviceUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.ThermostatDeviceCreateOrConnectWithoutUserInput | Prisma.ThermostatDeviceCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.ThermostatDeviceUpsertWithWhereUniqueWithoutUserInput | Prisma.ThermostatDeviceUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.ThermostatDeviceCreateManyUserInputEnvelope;
    set?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    disconnect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    delete?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    connect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    update?: Prisma.ThermostatDeviceUpdateWithWhereUniqueWithoutUserInput | Prisma.ThermostatDeviceUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.ThermostatDeviceUpdateManyWithWhereWithoutUserInput | Prisma.ThermostatDeviceUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.ThermostatDeviceScalarWhereInput | Prisma.ThermostatDeviceScalarWhereInput[];
};
export type ThermostatDeviceCreateNestedManyWithoutHomeProfileInput = {
    create?: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutHomeProfileInput, Prisma.ThermostatDeviceUncheckedCreateWithoutHomeProfileInput> | Prisma.ThermostatDeviceCreateWithoutHomeProfileInput[] | Prisma.ThermostatDeviceUncheckedCreateWithoutHomeProfileInput[];
    connectOrCreate?: Prisma.ThermostatDeviceCreateOrConnectWithoutHomeProfileInput | Prisma.ThermostatDeviceCreateOrConnectWithoutHomeProfileInput[];
    createMany?: Prisma.ThermostatDeviceCreateManyHomeProfileInputEnvelope;
    connect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
};
export type ThermostatDeviceUncheckedCreateNestedManyWithoutHomeProfileInput = {
    create?: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutHomeProfileInput, Prisma.ThermostatDeviceUncheckedCreateWithoutHomeProfileInput> | Prisma.ThermostatDeviceCreateWithoutHomeProfileInput[] | Prisma.ThermostatDeviceUncheckedCreateWithoutHomeProfileInput[];
    connectOrCreate?: Prisma.ThermostatDeviceCreateOrConnectWithoutHomeProfileInput | Prisma.ThermostatDeviceCreateOrConnectWithoutHomeProfileInput[];
    createMany?: Prisma.ThermostatDeviceCreateManyHomeProfileInputEnvelope;
    connect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
};
export type ThermostatDeviceUpdateManyWithoutHomeProfileNestedInput = {
    create?: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutHomeProfileInput, Prisma.ThermostatDeviceUncheckedCreateWithoutHomeProfileInput> | Prisma.ThermostatDeviceCreateWithoutHomeProfileInput[] | Prisma.ThermostatDeviceUncheckedCreateWithoutHomeProfileInput[];
    connectOrCreate?: Prisma.ThermostatDeviceCreateOrConnectWithoutHomeProfileInput | Prisma.ThermostatDeviceCreateOrConnectWithoutHomeProfileInput[];
    upsert?: Prisma.ThermostatDeviceUpsertWithWhereUniqueWithoutHomeProfileInput | Prisma.ThermostatDeviceUpsertWithWhereUniqueWithoutHomeProfileInput[];
    createMany?: Prisma.ThermostatDeviceCreateManyHomeProfileInputEnvelope;
    set?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    disconnect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    delete?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    connect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    update?: Prisma.ThermostatDeviceUpdateWithWhereUniqueWithoutHomeProfileInput | Prisma.ThermostatDeviceUpdateWithWhereUniqueWithoutHomeProfileInput[];
    updateMany?: Prisma.ThermostatDeviceUpdateManyWithWhereWithoutHomeProfileInput | Prisma.ThermostatDeviceUpdateManyWithWhereWithoutHomeProfileInput[];
    deleteMany?: Prisma.ThermostatDeviceScalarWhereInput | Prisma.ThermostatDeviceScalarWhereInput[];
};
export type ThermostatDeviceUncheckedUpdateManyWithoutHomeProfileNestedInput = {
    create?: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutHomeProfileInput, Prisma.ThermostatDeviceUncheckedCreateWithoutHomeProfileInput> | Prisma.ThermostatDeviceCreateWithoutHomeProfileInput[] | Prisma.ThermostatDeviceUncheckedCreateWithoutHomeProfileInput[];
    connectOrCreate?: Prisma.ThermostatDeviceCreateOrConnectWithoutHomeProfileInput | Prisma.ThermostatDeviceCreateOrConnectWithoutHomeProfileInput[];
    upsert?: Prisma.ThermostatDeviceUpsertWithWhereUniqueWithoutHomeProfileInput | Prisma.ThermostatDeviceUpsertWithWhereUniqueWithoutHomeProfileInput[];
    createMany?: Prisma.ThermostatDeviceCreateManyHomeProfileInputEnvelope;
    set?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    disconnect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    delete?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    connect?: Prisma.ThermostatDeviceWhereUniqueInput | Prisma.ThermostatDeviceWhereUniqueInput[];
    update?: Prisma.ThermostatDeviceUpdateWithWhereUniqueWithoutHomeProfileInput | Prisma.ThermostatDeviceUpdateWithWhereUniqueWithoutHomeProfileInput[];
    updateMany?: Prisma.ThermostatDeviceUpdateManyWithWhereWithoutHomeProfileInput | Prisma.ThermostatDeviceUpdateManyWithWhereWithoutHomeProfileInput[];
    deleteMany?: Prisma.ThermostatDeviceScalarWhereInput | Prisma.ThermostatDeviceScalarWhereInput[];
};
export type NullableDateTimeFieldUpdateOperationsInput = {
    set?: Date | string | null;
};
export type EnumThermostatModeFieldUpdateOperationsInput = {
    set?: $Enums.ThermostatMode;
};
export type ThermostatDeviceCreateNestedOneWithoutHeatingEventsInput = {
    create?: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutHeatingEventsInput, Prisma.ThermostatDeviceUncheckedCreateWithoutHeatingEventsInput>;
    connectOrCreate?: Prisma.ThermostatDeviceCreateOrConnectWithoutHeatingEventsInput;
    connect?: Prisma.ThermostatDeviceWhereUniqueInput;
};
export type ThermostatDeviceUpdateOneRequiredWithoutHeatingEventsNestedInput = {
    create?: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutHeatingEventsInput, Prisma.ThermostatDeviceUncheckedCreateWithoutHeatingEventsInput>;
    connectOrCreate?: Prisma.ThermostatDeviceCreateOrConnectWithoutHeatingEventsInput;
    upsert?: Prisma.ThermostatDeviceUpsertWithoutHeatingEventsInput;
    connect?: Prisma.ThermostatDeviceWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.ThermostatDeviceUpdateToOneWithWhereWithoutHeatingEventsInput, Prisma.ThermostatDeviceUpdateWithoutHeatingEventsInput>, Prisma.ThermostatDeviceUncheckedUpdateWithoutHeatingEventsInput>;
};
export type ThermostatDeviceCreateWithoutUserInput = {
    vendor: string;
    deviceId: string;
    alias?: string | null;
    lastSeen?: Date | string | null;
    mode?: $Enums.ThermostatMode;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    homeProfile: Prisma.HomeProfileCreateNestedOneWithoutThermostatDevicesInput;
    heatingEvents?: Prisma.HeatingEventCreateNestedManyWithoutThermostatInput;
};
export type ThermostatDeviceUncheckedCreateWithoutUserInput = {
    id?: number;
    homeProfileId: number;
    vendor: string;
    deviceId: string;
    alias?: string | null;
    lastSeen?: Date | string | null;
    mode?: $Enums.ThermostatMode;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    heatingEvents?: Prisma.HeatingEventUncheckedCreateNestedManyWithoutThermostatInput;
};
export type ThermostatDeviceCreateOrConnectWithoutUserInput = {
    where: Prisma.ThermostatDeviceWhereUniqueInput;
    create: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutUserInput, Prisma.ThermostatDeviceUncheckedCreateWithoutUserInput>;
};
export type ThermostatDeviceCreateManyUserInputEnvelope = {
    data: Prisma.ThermostatDeviceCreateManyUserInput | Prisma.ThermostatDeviceCreateManyUserInput[];
    skipDuplicates?: boolean;
};
export type ThermostatDeviceUpsertWithWhereUniqueWithoutUserInput = {
    where: Prisma.ThermostatDeviceWhereUniqueInput;
    update: Prisma.XOR<Prisma.ThermostatDeviceUpdateWithoutUserInput, Prisma.ThermostatDeviceUncheckedUpdateWithoutUserInput>;
    create: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutUserInput, Prisma.ThermostatDeviceUncheckedCreateWithoutUserInput>;
};
export type ThermostatDeviceUpdateWithWhereUniqueWithoutUserInput = {
    where: Prisma.ThermostatDeviceWhereUniqueInput;
    data: Prisma.XOR<Prisma.ThermostatDeviceUpdateWithoutUserInput, Prisma.ThermostatDeviceUncheckedUpdateWithoutUserInput>;
};
export type ThermostatDeviceUpdateManyWithWhereWithoutUserInput = {
    where: Prisma.ThermostatDeviceScalarWhereInput;
    data: Prisma.XOR<Prisma.ThermostatDeviceUpdateManyMutationInput, Prisma.ThermostatDeviceUncheckedUpdateManyWithoutUserInput>;
};
export type ThermostatDeviceScalarWhereInput = {
    AND?: Prisma.ThermostatDeviceScalarWhereInput | Prisma.ThermostatDeviceScalarWhereInput[];
    OR?: Prisma.ThermostatDeviceScalarWhereInput[];
    NOT?: Prisma.ThermostatDeviceScalarWhereInput | Prisma.ThermostatDeviceScalarWhereInput[];
    id?: Prisma.IntFilter<"ThermostatDevice"> | number;
    userId?: Prisma.IntFilter<"ThermostatDevice"> | number;
    homeProfileId?: Prisma.IntFilter<"ThermostatDevice"> | number;
    vendor?: Prisma.StringFilter<"ThermostatDevice"> | string;
    deviceId?: Prisma.StringFilter<"ThermostatDevice"> | string;
    alias?: Prisma.StringNullableFilter<"ThermostatDevice"> | string | null;
    lastSeen?: Prisma.DateTimeNullableFilter<"ThermostatDevice"> | Date | string | null;
    mode?: Prisma.EnumThermostatModeFilter<"ThermostatDevice"> | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFilter<"ThermostatDevice"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"ThermostatDevice"> | Date | string;
};
export type ThermostatDeviceCreateWithoutHomeProfileInput = {
    vendor: string;
    deviceId: string;
    alias?: string | null;
    lastSeen?: Date | string | null;
    mode?: $Enums.ThermostatMode;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutThermostatDevicesInput;
    heatingEvents?: Prisma.HeatingEventCreateNestedManyWithoutThermostatInput;
};
export type ThermostatDeviceUncheckedCreateWithoutHomeProfileInput = {
    id?: number;
    userId: number;
    vendor: string;
    deviceId: string;
    alias?: string | null;
    lastSeen?: Date | string | null;
    mode?: $Enums.ThermostatMode;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    heatingEvents?: Prisma.HeatingEventUncheckedCreateNestedManyWithoutThermostatInput;
};
export type ThermostatDeviceCreateOrConnectWithoutHomeProfileInput = {
    where: Prisma.ThermostatDeviceWhereUniqueInput;
    create: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutHomeProfileInput, Prisma.ThermostatDeviceUncheckedCreateWithoutHomeProfileInput>;
};
export type ThermostatDeviceCreateManyHomeProfileInputEnvelope = {
    data: Prisma.ThermostatDeviceCreateManyHomeProfileInput | Prisma.ThermostatDeviceCreateManyHomeProfileInput[];
    skipDuplicates?: boolean;
};
export type ThermostatDeviceUpsertWithWhereUniqueWithoutHomeProfileInput = {
    where: Prisma.ThermostatDeviceWhereUniqueInput;
    update: Prisma.XOR<Prisma.ThermostatDeviceUpdateWithoutHomeProfileInput, Prisma.ThermostatDeviceUncheckedUpdateWithoutHomeProfileInput>;
    create: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutHomeProfileInput, Prisma.ThermostatDeviceUncheckedCreateWithoutHomeProfileInput>;
};
export type ThermostatDeviceUpdateWithWhereUniqueWithoutHomeProfileInput = {
    where: Prisma.ThermostatDeviceWhereUniqueInput;
    data: Prisma.XOR<Prisma.ThermostatDeviceUpdateWithoutHomeProfileInput, Prisma.ThermostatDeviceUncheckedUpdateWithoutHomeProfileInput>;
};
export type ThermostatDeviceUpdateManyWithWhereWithoutHomeProfileInput = {
    where: Prisma.ThermostatDeviceScalarWhereInput;
    data: Prisma.XOR<Prisma.ThermostatDeviceUpdateManyMutationInput, Prisma.ThermostatDeviceUncheckedUpdateManyWithoutHomeProfileInput>;
};
export type ThermostatDeviceCreateWithoutHeatingEventsInput = {
    vendor: string;
    deviceId: string;
    alias?: string | null;
    lastSeen?: Date | string | null;
    mode?: $Enums.ThermostatMode;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutThermostatDevicesInput;
    homeProfile: Prisma.HomeProfileCreateNestedOneWithoutThermostatDevicesInput;
};
export type ThermostatDeviceUncheckedCreateWithoutHeatingEventsInput = {
    id?: number;
    userId: number;
    homeProfileId: number;
    vendor: string;
    deviceId: string;
    alias?: string | null;
    lastSeen?: Date | string | null;
    mode?: $Enums.ThermostatMode;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};
export type ThermostatDeviceCreateOrConnectWithoutHeatingEventsInput = {
    where: Prisma.ThermostatDeviceWhereUniqueInput;
    create: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutHeatingEventsInput, Prisma.ThermostatDeviceUncheckedCreateWithoutHeatingEventsInput>;
};
export type ThermostatDeviceUpsertWithoutHeatingEventsInput = {
    update: Prisma.XOR<Prisma.ThermostatDeviceUpdateWithoutHeatingEventsInput, Prisma.ThermostatDeviceUncheckedUpdateWithoutHeatingEventsInput>;
    create: Prisma.XOR<Prisma.ThermostatDeviceCreateWithoutHeatingEventsInput, Prisma.ThermostatDeviceUncheckedCreateWithoutHeatingEventsInput>;
    where?: Prisma.ThermostatDeviceWhereInput;
};
export type ThermostatDeviceUpdateToOneWithWhereWithoutHeatingEventsInput = {
    where?: Prisma.ThermostatDeviceWhereInput;
    data: Prisma.XOR<Prisma.ThermostatDeviceUpdateWithoutHeatingEventsInput, Prisma.ThermostatDeviceUncheckedUpdateWithoutHeatingEventsInput>;
};
export type ThermostatDeviceUpdateWithoutHeatingEventsInput = {
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutThermostatDevicesNestedInput;
    homeProfile?: Prisma.HomeProfileUpdateOneRequiredWithoutThermostatDevicesNestedInput;
};
export type ThermostatDeviceUncheckedUpdateWithoutHeatingEventsInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    homeProfileId?: Prisma.IntFieldUpdateOperationsInput | number;
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ThermostatDeviceCreateManyUserInput = {
    id?: number;
    homeProfileId: number;
    vendor: string;
    deviceId: string;
    alias?: string | null;
    lastSeen?: Date | string | null;
    mode?: $Enums.ThermostatMode;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};
export type ThermostatDeviceUpdateWithoutUserInput = {
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    homeProfile?: Prisma.HomeProfileUpdateOneRequiredWithoutThermostatDevicesNestedInput;
    heatingEvents?: Prisma.HeatingEventUpdateManyWithoutThermostatNestedInput;
};
export type ThermostatDeviceUncheckedUpdateWithoutUserInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    homeProfileId?: Prisma.IntFieldUpdateOperationsInput | number;
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    heatingEvents?: Prisma.HeatingEventUncheckedUpdateManyWithoutThermostatNestedInput;
};
export type ThermostatDeviceUncheckedUpdateManyWithoutUserInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    homeProfileId?: Prisma.IntFieldUpdateOperationsInput | number;
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ThermostatDeviceCreateManyHomeProfileInput = {
    id?: number;
    userId: number;
    vendor: string;
    deviceId: string;
    alias?: string | null;
    lastSeen?: Date | string | null;
    mode?: $Enums.ThermostatMode;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};
export type ThermostatDeviceUpdateWithoutHomeProfileInput = {
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutThermostatDevicesNestedInput;
    heatingEvents?: Prisma.HeatingEventUpdateManyWithoutThermostatNestedInput;
};
export type ThermostatDeviceUncheckedUpdateWithoutHomeProfileInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    heatingEvents?: Prisma.HeatingEventUncheckedUpdateManyWithoutThermostatNestedInput;
};
export type ThermostatDeviceUncheckedUpdateManyWithoutHomeProfileInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    vendor?: Prisma.StringFieldUpdateOperationsInput | string;
    deviceId?: Prisma.StringFieldUpdateOperationsInput | string;
    alias?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    lastSeen?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    mode?: Prisma.EnumThermostatModeFieldUpdateOperationsInput | $Enums.ThermostatMode;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type ThermostatDeviceCountOutputType = {
    heatingEvents: number;
};
export type ThermostatDeviceCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    heatingEvents?: boolean | ThermostatDeviceCountOutputTypeCountHeatingEventsArgs;
};
export type ThermostatDeviceCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ThermostatDeviceCountOutputTypeSelect<ExtArgs> | null;
};
export type ThermostatDeviceCountOutputTypeCountHeatingEventsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HeatingEventWhereInput;
};
export type ThermostatDeviceSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    userId?: boolean;
    homeProfileId?: boolean;
    vendor?: boolean;
    deviceId?: boolean;
    alias?: boolean;
    lastSeen?: boolean;
    mode?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
    homeProfile?: boolean | Prisma.HomeProfileDefaultArgs<ExtArgs>;
    heatingEvents?: boolean | Prisma.ThermostatDevice$heatingEventsArgs<ExtArgs>;
    _count?: boolean | Prisma.ThermostatDeviceCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["thermostatDevice"]>;
export type ThermostatDeviceSelectScalar = {
    id?: boolean;
    userId?: boolean;
    homeProfileId?: boolean;
    vendor?: boolean;
    deviceId?: boolean;
    alias?: boolean;
    lastSeen?: boolean;
    mode?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
};
export type ThermostatDeviceOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "userId" | "homeProfileId" | "vendor" | "deviceId" | "alias" | "lastSeen" | "mode" | "createdAt" | "updatedAt", ExtArgs["result"]["thermostatDevice"]>;
export type ThermostatDeviceInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
    homeProfile?: boolean | Prisma.HomeProfileDefaultArgs<ExtArgs>;
    heatingEvents?: boolean | Prisma.ThermostatDevice$heatingEventsArgs<ExtArgs>;
    _count?: boolean | Prisma.ThermostatDeviceCountOutputTypeDefaultArgs<ExtArgs>;
};
export type $ThermostatDevicePayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "ThermostatDevice";
    objects: {
        user: Prisma.$UserPayload<ExtArgs>;
        homeProfile: Prisma.$HomeProfilePayload<ExtArgs>;
        heatingEvents: Prisma.$HeatingEventPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: number;
        userId: number;
        homeProfileId: number;
        vendor: string;
        deviceId: string;
        alias: string | null;
        lastSeen: Date | null;
        mode: $Enums.ThermostatMode;
        createdAt: Date;
        updatedAt: Date;
    }, ExtArgs["result"]["thermostatDevice"]>;
    composites: {};
};
export type ThermostatDeviceGetPayload<S extends boolean | null | undefined | ThermostatDeviceDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload, S>;
export type ThermostatDeviceCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<ThermostatDeviceFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: ThermostatDeviceCountAggregateInputType | true;
};
export interface ThermostatDeviceDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['ThermostatDevice'];
        meta: {
            name: 'ThermostatDevice';
        };
    };
    findUnique<T extends ThermostatDeviceFindUniqueArgs>(args: Prisma.SelectSubset<T, ThermostatDeviceFindUniqueArgs<ExtArgs>>): Prisma.Prisma__ThermostatDeviceClient<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends ThermostatDeviceFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, ThermostatDeviceFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__ThermostatDeviceClient<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends ThermostatDeviceFindFirstArgs>(args?: Prisma.SelectSubset<T, ThermostatDeviceFindFirstArgs<ExtArgs>>): Prisma.Prisma__ThermostatDeviceClient<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends ThermostatDeviceFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, ThermostatDeviceFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__ThermostatDeviceClient<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends ThermostatDeviceFindManyArgs>(args?: Prisma.SelectSubset<T, ThermostatDeviceFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends ThermostatDeviceCreateArgs>(args: Prisma.SelectSubset<T, ThermostatDeviceCreateArgs<ExtArgs>>): Prisma.Prisma__ThermostatDeviceClient<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends ThermostatDeviceCreateManyArgs>(args?: Prisma.SelectSubset<T, ThermostatDeviceCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends ThermostatDeviceDeleteArgs>(args: Prisma.SelectSubset<T, ThermostatDeviceDeleteArgs<ExtArgs>>): Prisma.Prisma__ThermostatDeviceClient<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends ThermostatDeviceUpdateArgs>(args: Prisma.SelectSubset<T, ThermostatDeviceUpdateArgs<ExtArgs>>): Prisma.Prisma__ThermostatDeviceClient<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends ThermostatDeviceDeleteManyArgs>(args?: Prisma.SelectSubset<T, ThermostatDeviceDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends ThermostatDeviceUpdateManyArgs>(args: Prisma.SelectSubset<T, ThermostatDeviceUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends ThermostatDeviceUpsertArgs>(args: Prisma.SelectSubset<T, ThermostatDeviceUpsertArgs<ExtArgs>>): Prisma.Prisma__ThermostatDeviceClient<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends ThermostatDeviceCountArgs>(args?: Prisma.Subset<T, ThermostatDeviceCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], ThermostatDeviceCountAggregateOutputType> : number>;
    aggregate<T extends ThermostatDeviceAggregateArgs>(args: Prisma.Subset<T, ThermostatDeviceAggregateArgs>): Prisma.PrismaPromise<GetThermostatDeviceAggregateType<T>>;
    groupBy<T extends ThermostatDeviceGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: ThermostatDeviceGroupByArgs['orderBy'];
    } : {
        orderBy?: ThermostatDeviceGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, ThermostatDeviceGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetThermostatDeviceGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: ThermostatDeviceFieldRefs;
}
export interface Prisma__ThermostatDeviceClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    user<T extends Prisma.UserDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.UserDefaultArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    homeProfile<T extends Prisma.HomeProfileDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.HomeProfileDefaultArgs<ExtArgs>>): Prisma.Prisma__HomeProfileClient<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    heatingEvents<T extends Prisma.ThermostatDevice$heatingEventsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.ThermostatDevice$heatingEventsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$HeatingEventPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface ThermostatDeviceFieldRefs {
    readonly id: Prisma.FieldRef<"ThermostatDevice", 'Int'>;
    readonly userId: Prisma.FieldRef<"ThermostatDevice", 'Int'>;
    readonly homeProfileId: Prisma.FieldRef<"ThermostatDevice", 'Int'>;
    readonly vendor: Prisma.FieldRef<"ThermostatDevice", 'String'>;
    readonly deviceId: Prisma.FieldRef<"ThermostatDevice", 'String'>;
    readonly alias: Prisma.FieldRef<"ThermostatDevice", 'String'>;
    readonly lastSeen: Prisma.FieldRef<"ThermostatDevice", 'DateTime'>;
    readonly mode: Prisma.FieldRef<"ThermostatDevice", 'ThermostatMode'>;
    readonly createdAt: Prisma.FieldRef<"ThermostatDevice", 'DateTime'>;
    readonly updatedAt: Prisma.FieldRef<"ThermostatDevice", 'DateTime'>;
}
export type ThermostatDeviceFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ThermostatDeviceSelect<ExtArgs> | null;
    omit?: Prisma.ThermostatDeviceOmit<ExtArgs> | null;
    include?: Prisma.ThermostatDeviceInclude<ExtArgs> | null;
    where: Prisma.ThermostatDeviceWhereUniqueInput;
};
export type ThermostatDeviceFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ThermostatDeviceSelect<ExtArgs> | null;
    omit?: Prisma.ThermostatDeviceOmit<ExtArgs> | null;
    include?: Prisma.ThermostatDeviceInclude<ExtArgs> | null;
    where: Prisma.ThermostatDeviceWhereUniqueInput;
};
export type ThermostatDeviceFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ThermostatDeviceSelect<ExtArgs> | null;
    omit?: Prisma.ThermostatDeviceOmit<ExtArgs> | null;
    include?: Prisma.ThermostatDeviceInclude<ExtArgs> | null;
    where?: Prisma.ThermostatDeviceWhereInput;
    orderBy?: Prisma.ThermostatDeviceOrderByWithRelationInput | Prisma.ThermostatDeviceOrderByWithRelationInput[];
    cursor?: Prisma.ThermostatDeviceWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ThermostatDeviceScalarFieldEnum | Prisma.ThermostatDeviceScalarFieldEnum[];
};
export type ThermostatDeviceFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ThermostatDeviceSelect<ExtArgs> | null;
    omit?: Prisma.ThermostatDeviceOmit<ExtArgs> | null;
    include?: Prisma.ThermostatDeviceInclude<ExtArgs> | null;
    where?: Prisma.ThermostatDeviceWhereInput;
    orderBy?: Prisma.ThermostatDeviceOrderByWithRelationInput | Prisma.ThermostatDeviceOrderByWithRelationInput[];
    cursor?: Prisma.ThermostatDeviceWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ThermostatDeviceScalarFieldEnum | Prisma.ThermostatDeviceScalarFieldEnum[];
};
export type ThermostatDeviceFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ThermostatDeviceSelect<ExtArgs> | null;
    omit?: Prisma.ThermostatDeviceOmit<ExtArgs> | null;
    include?: Prisma.ThermostatDeviceInclude<ExtArgs> | null;
    where?: Prisma.ThermostatDeviceWhereInput;
    orderBy?: Prisma.ThermostatDeviceOrderByWithRelationInput | Prisma.ThermostatDeviceOrderByWithRelationInput[];
    cursor?: Prisma.ThermostatDeviceWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.ThermostatDeviceScalarFieldEnum | Prisma.ThermostatDeviceScalarFieldEnum[];
};
export type ThermostatDeviceCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ThermostatDeviceSelect<ExtArgs> | null;
    omit?: Prisma.ThermostatDeviceOmit<ExtArgs> | null;
    include?: Prisma.ThermostatDeviceInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ThermostatDeviceCreateInput, Prisma.ThermostatDeviceUncheckedCreateInput>;
};
export type ThermostatDeviceCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.ThermostatDeviceCreateManyInput | Prisma.ThermostatDeviceCreateManyInput[];
    skipDuplicates?: boolean;
};
export type ThermostatDeviceUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ThermostatDeviceSelect<ExtArgs> | null;
    omit?: Prisma.ThermostatDeviceOmit<ExtArgs> | null;
    include?: Prisma.ThermostatDeviceInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.ThermostatDeviceUpdateInput, Prisma.ThermostatDeviceUncheckedUpdateInput>;
    where: Prisma.ThermostatDeviceWhereUniqueInput;
};
export type ThermostatDeviceUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.ThermostatDeviceUpdateManyMutationInput, Prisma.ThermostatDeviceUncheckedUpdateManyInput>;
    where?: Prisma.ThermostatDeviceWhereInput;
    limit?: number;
};
export type ThermostatDeviceUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ThermostatDeviceSelect<ExtArgs> | null;
    omit?: Prisma.ThermostatDeviceOmit<ExtArgs> | null;
    include?: Prisma.ThermostatDeviceInclude<ExtArgs> | null;
    where: Prisma.ThermostatDeviceWhereUniqueInput;
    create: Prisma.XOR<Prisma.ThermostatDeviceCreateInput, Prisma.ThermostatDeviceUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.ThermostatDeviceUpdateInput, Prisma.ThermostatDeviceUncheckedUpdateInput>;
};
export type ThermostatDeviceDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ThermostatDeviceSelect<ExtArgs> | null;
    omit?: Prisma.ThermostatDeviceOmit<ExtArgs> | null;
    include?: Prisma.ThermostatDeviceInclude<ExtArgs> | null;
    where: Prisma.ThermostatDeviceWhereUniqueInput;
};
export type ThermostatDeviceDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ThermostatDeviceWhereInput;
    limit?: number;
};
export type ThermostatDevice$heatingEventsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type ThermostatDeviceDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.ThermostatDeviceSelect<ExtArgs> | null;
    omit?: Prisma.ThermostatDeviceOmit<ExtArgs> | null;
    include?: Prisma.ThermostatDeviceInclude<ExtArgs> | null;
};
export {};
