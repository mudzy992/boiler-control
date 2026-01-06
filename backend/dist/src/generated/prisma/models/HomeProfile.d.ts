import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type HomeProfileModel = runtime.Types.Result.DefaultSelection<Prisma.$HomeProfilePayload>;
export type AggregateHomeProfile = {
    _count: HomeProfileCountAggregateOutputType | null;
    _avg: HomeProfileAvgAggregateOutputType | null;
    _sum: HomeProfileSumAggregateOutputType | null;
    _min: HomeProfileMinAggregateOutputType | null;
    _max: HomeProfileMaxAggregateOutputType | null;
};
export type HomeProfileAvgAggregateOutputType = {
    id: number | null;
    userId: number | null;
    floorArea: number | null;
    ceilingHeight: number | null;
    insulationThickness: number | null;
    constructionYear: number | null;
    learningOffset: number | null;
    learningConfidence: number | null;
};
export type HomeProfileSumAggregateOutputType = {
    id: number | null;
    userId: number | null;
    floorArea: number | null;
    ceilingHeight: number | null;
    insulationThickness: number | null;
    constructionYear: number | null;
    learningOffset: number | null;
    learningConfidence: number | null;
};
export type HomeProfileMinAggregateOutputType = {
    id: number | null;
    userId: number | null;
    floorArea: number | null;
    ceilingHeight: number | null;
    insulationType: string | null;
    insulationThickness: number | null;
    windowType: string | null;
    heatingType: string | null;
    constructionYear: number | null;
    learningOffset: number | null;
    learningConfidence: number | null;
    createdAt: Date | null;
    updatedAt: Date | null;
};
export type HomeProfileMaxAggregateOutputType = {
    id: number | null;
    userId: number | null;
    floorArea: number | null;
    ceilingHeight: number | null;
    insulationType: string | null;
    insulationThickness: number | null;
    windowType: string | null;
    heatingType: string | null;
    constructionYear: number | null;
    learningOffset: number | null;
    learningConfidence: number | null;
    createdAt: Date | null;
    updatedAt: Date | null;
};
export type HomeProfileCountAggregateOutputType = {
    id: number;
    userId: number;
    floorArea: number;
    ceilingHeight: number;
    insulationType: number;
    insulationThickness: number;
    windowType: number;
    heatingType: number;
    constructionYear: number;
    learningOffset: number;
    learningConfidence: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
};
export type HomeProfileAvgAggregateInputType = {
    id?: true;
    userId?: true;
    floorArea?: true;
    ceilingHeight?: true;
    insulationThickness?: true;
    constructionYear?: true;
    learningOffset?: true;
    learningConfidence?: true;
};
export type HomeProfileSumAggregateInputType = {
    id?: true;
    userId?: true;
    floorArea?: true;
    ceilingHeight?: true;
    insulationThickness?: true;
    constructionYear?: true;
    learningOffset?: true;
    learningConfidence?: true;
};
export type HomeProfileMinAggregateInputType = {
    id?: true;
    userId?: true;
    floorArea?: true;
    ceilingHeight?: true;
    insulationType?: true;
    insulationThickness?: true;
    windowType?: true;
    heatingType?: true;
    constructionYear?: true;
    learningOffset?: true;
    learningConfidence?: true;
    createdAt?: true;
    updatedAt?: true;
};
export type HomeProfileMaxAggregateInputType = {
    id?: true;
    userId?: true;
    floorArea?: true;
    ceilingHeight?: true;
    insulationType?: true;
    insulationThickness?: true;
    windowType?: true;
    heatingType?: true;
    constructionYear?: true;
    learningOffset?: true;
    learningConfidence?: true;
    createdAt?: true;
    updatedAt?: true;
};
export type HomeProfileCountAggregateInputType = {
    id?: true;
    userId?: true;
    floorArea?: true;
    ceilingHeight?: true;
    insulationType?: true;
    insulationThickness?: true;
    windowType?: true;
    heatingType?: true;
    constructionYear?: true;
    learningOffset?: true;
    learningConfidence?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
};
export type HomeProfileAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HomeProfileWhereInput;
    orderBy?: Prisma.HomeProfileOrderByWithRelationInput | Prisma.HomeProfileOrderByWithRelationInput[];
    cursor?: Prisma.HomeProfileWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | HomeProfileCountAggregateInputType;
    _avg?: HomeProfileAvgAggregateInputType;
    _sum?: HomeProfileSumAggregateInputType;
    _min?: HomeProfileMinAggregateInputType;
    _max?: HomeProfileMaxAggregateInputType;
};
export type GetHomeProfileAggregateType<T extends HomeProfileAggregateArgs> = {
    [P in keyof T & keyof AggregateHomeProfile]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateHomeProfile[P]> : Prisma.GetScalarType<T[P], AggregateHomeProfile[P]>;
};
export type HomeProfileGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HomeProfileWhereInput;
    orderBy?: Prisma.HomeProfileOrderByWithAggregationInput | Prisma.HomeProfileOrderByWithAggregationInput[];
    by: Prisma.HomeProfileScalarFieldEnum[] | Prisma.HomeProfileScalarFieldEnum;
    having?: Prisma.HomeProfileScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: HomeProfileCountAggregateInputType | true;
    _avg?: HomeProfileAvgAggregateInputType;
    _sum?: HomeProfileSumAggregateInputType;
    _min?: HomeProfileMinAggregateInputType;
    _max?: HomeProfileMaxAggregateInputType;
};
export type HomeProfileGroupByOutputType = {
    id: number;
    userId: number;
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    insulationThickness: number;
    windowType: string;
    heatingType: string;
    constructionYear: number;
    learningOffset: number;
    learningConfidence: number;
    createdAt: Date;
    updatedAt: Date;
    _count: HomeProfileCountAggregateOutputType | null;
    _avg: HomeProfileAvgAggregateOutputType | null;
    _sum: HomeProfileSumAggregateOutputType | null;
    _min: HomeProfileMinAggregateOutputType | null;
    _max: HomeProfileMaxAggregateOutputType | null;
};
type GetHomeProfileGroupByPayload<T extends HomeProfileGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<HomeProfileGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof HomeProfileGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], HomeProfileGroupByOutputType[P]> : Prisma.GetScalarType<T[P], HomeProfileGroupByOutputType[P]>;
}>>;
export type HomeProfileWhereInput = {
    AND?: Prisma.HomeProfileWhereInput | Prisma.HomeProfileWhereInput[];
    OR?: Prisma.HomeProfileWhereInput[];
    NOT?: Prisma.HomeProfileWhereInput | Prisma.HomeProfileWhereInput[];
    id?: Prisma.IntFilter<"HomeProfile"> | number;
    userId?: Prisma.IntFilter<"HomeProfile"> | number;
    floorArea?: Prisma.FloatFilter<"HomeProfile"> | number;
    ceilingHeight?: Prisma.FloatFilter<"HomeProfile"> | number;
    insulationType?: Prisma.StringFilter<"HomeProfile"> | string;
    insulationThickness?: Prisma.FloatFilter<"HomeProfile"> | number;
    windowType?: Prisma.StringFilter<"HomeProfile"> | string;
    heatingType?: Prisma.StringFilter<"HomeProfile"> | string;
    constructionYear?: Prisma.IntFilter<"HomeProfile"> | number;
    learningOffset?: Prisma.FloatFilter<"HomeProfile"> | number;
    learningConfidence?: Prisma.FloatFilter<"HomeProfile"> | number;
    createdAt?: Prisma.DateTimeFilter<"HomeProfile"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"HomeProfile"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
    thermostatDevices?: Prisma.ThermostatDeviceListRelationFilter;
    intervalLearnings?: Prisma.HeatingIntervalLearningListRelationFilter;
};
export type HomeProfileOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    floorArea?: Prisma.SortOrder;
    ceilingHeight?: Prisma.SortOrder;
    insulationType?: Prisma.SortOrder;
    insulationThickness?: Prisma.SortOrder;
    windowType?: Prisma.SortOrder;
    heatingType?: Prisma.SortOrder;
    constructionYear?: Prisma.SortOrder;
    learningOffset?: Prisma.SortOrder;
    learningConfidence?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    user?: Prisma.UserOrderByWithRelationInput;
    thermostatDevices?: Prisma.ThermostatDeviceOrderByRelationAggregateInput;
    intervalLearnings?: Prisma.HeatingIntervalLearningOrderByRelationAggregateInput;
    _relevance?: Prisma.HomeProfileOrderByRelevanceInput;
};
export type HomeProfileWhereUniqueInput = Prisma.AtLeast<{
    id?: number;
    AND?: Prisma.HomeProfileWhereInput | Prisma.HomeProfileWhereInput[];
    OR?: Prisma.HomeProfileWhereInput[];
    NOT?: Prisma.HomeProfileWhereInput | Prisma.HomeProfileWhereInput[];
    userId?: Prisma.IntFilter<"HomeProfile"> | number;
    floorArea?: Prisma.FloatFilter<"HomeProfile"> | number;
    ceilingHeight?: Prisma.FloatFilter<"HomeProfile"> | number;
    insulationType?: Prisma.StringFilter<"HomeProfile"> | string;
    insulationThickness?: Prisma.FloatFilter<"HomeProfile"> | number;
    windowType?: Prisma.StringFilter<"HomeProfile"> | string;
    heatingType?: Prisma.StringFilter<"HomeProfile"> | string;
    constructionYear?: Prisma.IntFilter<"HomeProfile"> | number;
    learningOffset?: Prisma.FloatFilter<"HomeProfile"> | number;
    learningConfidence?: Prisma.FloatFilter<"HomeProfile"> | number;
    createdAt?: Prisma.DateTimeFilter<"HomeProfile"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"HomeProfile"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
    thermostatDevices?: Prisma.ThermostatDeviceListRelationFilter;
    intervalLearnings?: Prisma.HeatingIntervalLearningListRelationFilter;
}, "id">;
export type HomeProfileOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    floorArea?: Prisma.SortOrder;
    ceilingHeight?: Prisma.SortOrder;
    insulationType?: Prisma.SortOrder;
    insulationThickness?: Prisma.SortOrder;
    windowType?: Prisma.SortOrder;
    heatingType?: Prisma.SortOrder;
    constructionYear?: Prisma.SortOrder;
    learningOffset?: Prisma.SortOrder;
    learningConfidence?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    _count?: Prisma.HomeProfileCountOrderByAggregateInput;
    _avg?: Prisma.HomeProfileAvgOrderByAggregateInput;
    _max?: Prisma.HomeProfileMaxOrderByAggregateInput;
    _min?: Prisma.HomeProfileMinOrderByAggregateInput;
    _sum?: Prisma.HomeProfileSumOrderByAggregateInput;
};
export type HomeProfileScalarWhereWithAggregatesInput = {
    AND?: Prisma.HomeProfileScalarWhereWithAggregatesInput | Prisma.HomeProfileScalarWhereWithAggregatesInput[];
    OR?: Prisma.HomeProfileScalarWhereWithAggregatesInput[];
    NOT?: Prisma.HomeProfileScalarWhereWithAggregatesInput | Prisma.HomeProfileScalarWhereWithAggregatesInput[];
    id?: Prisma.IntWithAggregatesFilter<"HomeProfile"> | number;
    userId?: Prisma.IntWithAggregatesFilter<"HomeProfile"> | number;
    floorArea?: Prisma.FloatWithAggregatesFilter<"HomeProfile"> | number;
    ceilingHeight?: Prisma.FloatWithAggregatesFilter<"HomeProfile"> | number;
    insulationType?: Prisma.StringWithAggregatesFilter<"HomeProfile"> | string;
    insulationThickness?: Prisma.FloatWithAggregatesFilter<"HomeProfile"> | number;
    windowType?: Prisma.StringWithAggregatesFilter<"HomeProfile"> | string;
    heatingType?: Prisma.StringWithAggregatesFilter<"HomeProfile"> | string;
    constructionYear?: Prisma.IntWithAggregatesFilter<"HomeProfile"> | number;
    learningOffset?: Prisma.FloatWithAggregatesFilter<"HomeProfile"> | number;
    learningConfidence?: Prisma.FloatWithAggregatesFilter<"HomeProfile"> | number;
    createdAt?: Prisma.DateTimeWithAggregatesFilter<"HomeProfile"> | Date | string;
    updatedAt?: Prisma.DateTimeWithAggregatesFilter<"HomeProfile"> | Date | string;
};
export type HomeProfileCreateInput = {
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    insulationThickness: number;
    windowType: string;
    heatingType: string;
    constructionYear: number;
    learningOffset?: number;
    learningConfidence?: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutHomeProfilesInput;
    thermostatDevices?: Prisma.ThermostatDeviceCreateNestedManyWithoutHomeProfileInput;
    intervalLearnings?: Prisma.HeatingIntervalLearningCreateNestedManyWithoutHomeProfileInput;
};
export type HomeProfileUncheckedCreateInput = {
    id?: number;
    userId: number;
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    insulationThickness: number;
    windowType: string;
    heatingType: string;
    constructionYear: number;
    learningOffset?: number;
    learningConfidence?: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedCreateNestedManyWithoutHomeProfileInput;
    intervalLearnings?: Prisma.HeatingIntervalLearningUncheckedCreateNestedManyWithoutHomeProfileInput;
};
export type HomeProfileUpdateInput = {
    floorArea?: Prisma.FloatFieldUpdateOperationsInput | number;
    ceilingHeight?: Prisma.FloatFieldUpdateOperationsInput | number;
    insulationType?: Prisma.StringFieldUpdateOperationsInput | string;
    insulationThickness?: Prisma.FloatFieldUpdateOperationsInput | number;
    windowType?: Prisma.StringFieldUpdateOperationsInput | string;
    heatingType?: Prisma.StringFieldUpdateOperationsInput | string;
    constructionYear?: Prisma.IntFieldUpdateOperationsInput | number;
    learningOffset?: Prisma.FloatFieldUpdateOperationsInput | number;
    learningConfidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutHomeProfilesNestedInput;
    thermostatDevices?: Prisma.ThermostatDeviceUpdateManyWithoutHomeProfileNestedInput;
    intervalLearnings?: Prisma.HeatingIntervalLearningUpdateManyWithoutHomeProfileNestedInput;
};
export type HomeProfileUncheckedUpdateInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    floorArea?: Prisma.FloatFieldUpdateOperationsInput | number;
    ceilingHeight?: Prisma.FloatFieldUpdateOperationsInput | number;
    insulationType?: Prisma.StringFieldUpdateOperationsInput | string;
    insulationThickness?: Prisma.FloatFieldUpdateOperationsInput | number;
    windowType?: Prisma.StringFieldUpdateOperationsInput | string;
    heatingType?: Prisma.StringFieldUpdateOperationsInput | string;
    constructionYear?: Prisma.IntFieldUpdateOperationsInput | number;
    learningOffset?: Prisma.FloatFieldUpdateOperationsInput | number;
    learningConfidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedUpdateManyWithoutHomeProfileNestedInput;
    intervalLearnings?: Prisma.HeatingIntervalLearningUncheckedUpdateManyWithoutHomeProfileNestedInput;
};
export type HomeProfileCreateManyInput = {
    id?: number;
    userId: number;
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    insulationThickness: number;
    windowType: string;
    heatingType: string;
    constructionYear: number;
    learningOffset?: number;
    learningConfidence?: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};
export type HomeProfileUpdateManyMutationInput = {
    floorArea?: Prisma.FloatFieldUpdateOperationsInput | number;
    ceilingHeight?: Prisma.FloatFieldUpdateOperationsInput | number;
    insulationType?: Prisma.StringFieldUpdateOperationsInput | string;
    insulationThickness?: Prisma.FloatFieldUpdateOperationsInput | number;
    windowType?: Prisma.StringFieldUpdateOperationsInput | string;
    heatingType?: Prisma.StringFieldUpdateOperationsInput | string;
    constructionYear?: Prisma.IntFieldUpdateOperationsInput | number;
    learningOffset?: Prisma.FloatFieldUpdateOperationsInput | number;
    learningConfidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HomeProfileUncheckedUpdateManyInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    floorArea?: Prisma.FloatFieldUpdateOperationsInput | number;
    ceilingHeight?: Prisma.FloatFieldUpdateOperationsInput | number;
    insulationType?: Prisma.StringFieldUpdateOperationsInput | string;
    insulationThickness?: Prisma.FloatFieldUpdateOperationsInput | number;
    windowType?: Prisma.StringFieldUpdateOperationsInput | string;
    heatingType?: Prisma.StringFieldUpdateOperationsInput | string;
    constructionYear?: Prisma.IntFieldUpdateOperationsInput | number;
    learningOffset?: Prisma.FloatFieldUpdateOperationsInput | number;
    learningConfidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HomeProfileListRelationFilter = {
    every?: Prisma.HomeProfileWhereInput;
    some?: Prisma.HomeProfileWhereInput;
    none?: Prisma.HomeProfileWhereInput;
};
export type HomeProfileOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type HomeProfileOrderByRelevanceInput = {
    fields: Prisma.HomeProfileOrderByRelevanceFieldEnum | Prisma.HomeProfileOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type HomeProfileCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    floorArea?: Prisma.SortOrder;
    ceilingHeight?: Prisma.SortOrder;
    insulationType?: Prisma.SortOrder;
    insulationThickness?: Prisma.SortOrder;
    windowType?: Prisma.SortOrder;
    heatingType?: Prisma.SortOrder;
    constructionYear?: Prisma.SortOrder;
    learningOffset?: Prisma.SortOrder;
    learningConfidence?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type HomeProfileAvgOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    floorArea?: Prisma.SortOrder;
    ceilingHeight?: Prisma.SortOrder;
    insulationThickness?: Prisma.SortOrder;
    constructionYear?: Prisma.SortOrder;
    learningOffset?: Prisma.SortOrder;
    learningConfidence?: Prisma.SortOrder;
};
export type HomeProfileMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    floorArea?: Prisma.SortOrder;
    ceilingHeight?: Prisma.SortOrder;
    insulationType?: Prisma.SortOrder;
    insulationThickness?: Prisma.SortOrder;
    windowType?: Prisma.SortOrder;
    heatingType?: Prisma.SortOrder;
    constructionYear?: Prisma.SortOrder;
    learningOffset?: Prisma.SortOrder;
    learningConfidence?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type HomeProfileMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    floorArea?: Prisma.SortOrder;
    ceilingHeight?: Prisma.SortOrder;
    insulationType?: Prisma.SortOrder;
    insulationThickness?: Prisma.SortOrder;
    windowType?: Prisma.SortOrder;
    heatingType?: Prisma.SortOrder;
    constructionYear?: Prisma.SortOrder;
    learningOffset?: Prisma.SortOrder;
    learningConfidence?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type HomeProfileSumOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    floorArea?: Prisma.SortOrder;
    ceilingHeight?: Prisma.SortOrder;
    insulationThickness?: Prisma.SortOrder;
    constructionYear?: Prisma.SortOrder;
    learningOffset?: Prisma.SortOrder;
    learningConfidence?: Prisma.SortOrder;
};
export type HomeProfileScalarRelationFilter = {
    is?: Prisma.HomeProfileWhereInput;
    isNot?: Prisma.HomeProfileWhereInput;
};
export type HomeProfileCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.HomeProfileCreateWithoutUserInput, Prisma.HomeProfileUncheckedCreateWithoutUserInput> | Prisma.HomeProfileCreateWithoutUserInput[] | Prisma.HomeProfileUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.HomeProfileCreateOrConnectWithoutUserInput | Prisma.HomeProfileCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.HomeProfileCreateManyUserInputEnvelope;
    connect?: Prisma.HomeProfileWhereUniqueInput | Prisma.HomeProfileWhereUniqueInput[];
};
export type HomeProfileUncheckedCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.HomeProfileCreateWithoutUserInput, Prisma.HomeProfileUncheckedCreateWithoutUserInput> | Prisma.HomeProfileCreateWithoutUserInput[] | Prisma.HomeProfileUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.HomeProfileCreateOrConnectWithoutUserInput | Prisma.HomeProfileCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.HomeProfileCreateManyUserInputEnvelope;
    connect?: Prisma.HomeProfileWhereUniqueInput | Prisma.HomeProfileWhereUniqueInput[];
};
export type HomeProfileUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.HomeProfileCreateWithoutUserInput, Prisma.HomeProfileUncheckedCreateWithoutUserInput> | Prisma.HomeProfileCreateWithoutUserInput[] | Prisma.HomeProfileUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.HomeProfileCreateOrConnectWithoutUserInput | Prisma.HomeProfileCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.HomeProfileUpsertWithWhereUniqueWithoutUserInput | Prisma.HomeProfileUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.HomeProfileCreateManyUserInputEnvelope;
    set?: Prisma.HomeProfileWhereUniqueInput | Prisma.HomeProfileWhereUniqueInput[];
    disconnect?: Prisma.HomeProfileWhereUniqueInput | Prisma.HomeProfileWhereUniqueInput[];
    delete?: Prisma.HomeProfileWhereUniqueInput | Prisma.HomeProfileWhereUniqueInput[];
    connect?: Prisma.HomeProfileWhereUniqueInput | Prisma.HomeProfileWhereUniqueInput[];
    update?: Prisma.HomeProfileUpdateWithWhereUniqueWithoutUserInput | Prisma.HomeProfileUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.HomeProfileUpdateManyWithWhereWithoutUserInput | Prisma.HomeProfileUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.HomeProfileScalarWhereInput | Prisma.HomeProfileScalarWhereInput[];
};
export type HomeProfileUncheckedUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.HomeProfileCreateWithoutUserInput, Prisma.HomeProfileUncheckedCreateWithoutUserInput> | Prisma.HomeProfileCreateWithoutUserInput[] | Prisma.HomeProfileUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.HomeProfileCreateOrConnectWithoutUserInput | Prisma.HomeProfileCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.HomeProfileUpsertWithWhereUniqueWithoutUserInput | Prisma.HomeProfileUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.HomeProfileCreateManyUserInputEnvelope;
    set?: Prisma.HomeProfileWhereUniqueInput | Prisma.HomeProfileWhereUniqueInput[];
    disconnect?: Prisma.HomeProfileWhereUniqueInput | Prisma.HomeProfileWhereUniqueInput[];
    delete?: Prisma.HomeProfileWhereUniqueInput | Prisma.HomeProfileWhereUniqueInput[];
    connect?: Prisma.HomeProfileWhereUniqueInput | Prisma.HomeProfileWhereUniqueInput[];
    update?: Prisma.HomeProfileUpdateWithWhereUniqueWithoutUserInput | Prisma.HomeProfileUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.HomeProfileUpdateManyWithWhereWithoutUserInput | Prisma.HomeProfileUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.HomeProfileScalarWhereInput | Prisma.HomeProfileScalarWhereInput[];
};
export type FloatFieldUpdateOperationsInput = {
    set?: number;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
};
export type HomeProfileCreateNestedOneWithoutThermostatDevicesInput = {
    create?: Prisma.XOR<Prisma.HomeProfileCreateWithoutThermostatDevicesInput, Prisma.HomeProfileUncheckedCreateWithoutThermostatDevicesInput>;
    connectOrCreate?: Prisma.HomeProfileCreateOrConnectWithoutThermostatDevicesInput;
    connect?: Prisma.HomeProfileWhereUniqueInput;
};
export type HomeProfileUpdateOneRequiredWithoutThermostatDevicesNestedInput = {
    create?: Prisma.XOR<Prisma.HomeProfileCreateWithoutThermostatDevicesInput, Prisma.HomeProfileUncheckedCreateWithoutThermostatDevicesInput>;
    connectOrCreate?: Prisma.HomeProfileCreateOrConnectWithoutThermostatDevicesInput;
    upsert?: Prisma.HomeProfileUpsertWithoutThermostatDevicesInput;
    connect?: Prisma.HomeProfileWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.HomeProfileUpdateToOneWithWhereWithoutThermostatDevicesInput, Prisma.HomeProfileUpdateWithoutThermostatDevicesInput>, Prisma.HomeProfileUncheckedUpdateWithoutThermostatDevicesInput>;
};
export type HomeProfileCreateNestedOneWithoutIntervalLearningsInput = {
    create?: Prisma.XOR<Prisma.HomeProfileCreateWithoutIntervalLearningsInput, Prisma.HomeProfileUncheckedCreateWithoutIntervalLearningsInput>;
    connectOrCreate?: Prisma.HomeProfileCreateOrConnectWithoutIntervalLearningsInput;
    connect?: Prisma.HomeProfileWhereUniqueInput;
};
export type HomeProfileUpdateOneRequiredWithoutIntervalLearningsNestedInput = {
    create?: Prisma.XOR<Prisma.HomeProfileCreateWithoutIntervalLearningsInput, Prisma.HomeProfileUncheckedCreateWithoutIntervalLearningsInput>;
    connectOrCreate?: Prisma.HomeProfileCreateOrConnectWithoutIntervalLearningsInput;
    upsert?: Prisma.HomeProfileUpsertWithoutIntervalLearningsInput;
    connect?: Prisma.HomeProfileWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.HomeProfileUpdateToOneWithWhereWithoutIntervalLearningsInput, Prisma.HomeProfileUpdateWithoutIntervalLearningsInput>, Prisma.HomeProfileUncheckedUpdateWithoutIntervalLearningsInput>;
};
export type HomeProfileCreateWithoutUserInput = {
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    insulationThickness: number;
    windowType: string;
    heatingType: string;
    constructionYear: number;
    learningOffset?: number;
    learningConfidence?: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceCreateNestedManyWithoutHomeProfileInput;
    intervalLearnings?: Prisma.HeatingIntervalLearningCreateNestedManyWithoutHomeProfileInput;
};
export type HomeProfileUncheckedCreateWithoutUserInput = {
    id?: number;
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    insulationThickness: number;
    windowType: string;
    heatingType: string;
    constructionYear: number;
    learningOffset?: number;
    learningConfidence?: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedCreateNestedManyWithoutHomeProfileInput;
    intervalLearnings?: Prisma.HeatingIntervalLearningUncheckedCreateNestedManyWithoutHomeProfileInput;
};
export type HomeProfileCreateOrConnectWithoutUserInput = {
    where: Prisma.HomeProfileWhereUniqueInput;
    create: Prisma.XOR<Prisma.HomeProfileCreateWithoutUserInput, Prisma.HomeProfileUncheckedCreateWithoutUserInput>;
};
export type HomeProfileCreateManyUserInputEnvelope = {
    data: Prisma.HomeProfileCreateManyUserInput | Prisma.HomeProfileCreateManyUserInput[];
    skipDuplicates?: boolean;
};
export type HomeProfileUpsertWithWhereUniqueWithoutUserInput = {
    where: Prisma.HomeProfileWhereUniqueInput;
    update: Prisma.XOR<Prisma.HomeProfileUpdateWithoutUserInput, Prisma.HomeProfileUncheckedUpdateWithoutUserInput>;
    create: Prisma.XOR<Prisma.HomeProfileCreateWithoutUserInput, Prisma.HomeProfileUncheckedCreateWithoutUserInput>;
};
export type HomeProfileUpdateWithWhereUniqueWithoutUserInput = {
    where: Prisma.HomeProfileWhereUniqueInput;
    data: Prisma.XOR<Prisma.HomeProfileUpdateWithoutUserInput, Prisma.HomeProfileUncheckedUpdateWithoutUserInput>;
};
export type HomeProfileUpdateManyWithWhereWithoutUserInput = {
    where: Prisma.HomeProfileScalarWhereInput;
    data: Prisma.XOR<Prisma.HomeProfileUpdateManyMutationInput, Prisma.HomeProfileUncheckedUpdateManyWithoutUserInput>;
};
export type HomeProfileScalarWhereInput = {
    AND?: Prisma.HomeProfileScalarWhereInput | Prisma.HomeProfileScalarWhereInput[];
    OR?: Prisma.HomeProfileScalarWhereInput[];
    NOT?: Prisma.HomeProfileScalarWhereInput | Prisma.HomeProfileScalarWhereInput[];
    id?: Prisma.IntFilter<"HomeProfile"> | number;
    userId?: Prisma.IntFilter<"HomeProfile"> | number;
    floorArea?: Prisma.FloatFilter<"HomeProfile"> | number;
    ceilingHeight?: Prisma.FloatFilter<"HomeProfile"> | number;
    insulationType?: Prisma.StringFilter<"HomeProfile"> | string;
    insulationThickness?: Prisma.FloatFilter<"HomeProfile"> | number;
    windowType?: Prisma.StringFilter<"HomeProfile"> | string;
    heatingType?: Prisma.StringFilter<"HomeProfile"> | string;
    constructionYear?: Prisma.IntFilter<"HomeProfile"> | number;
    learningOffset?: Prisma.FloatFilter<"HomeProfile"> | number;
    learningConfidence?: Prisma.FloatFilter<"HomeProfile"> | number;
    createdAt?: Prisma.DateTimeFilter<"HomeProfile"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"HomeProfile"> | Date | string;
};
export type HomeProfileCreateWithoutThermostatDevicesInput = {
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    insulationThickness: number;
    windowType: string;
    heatingType: string;
    constructionYear: number;
    learningOffset?: number;
    learningConfidence?: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutHomeProfilesInput;
    intervalLearnings?: Prisma.HeatingIntervalLearningCreateNestedManyWithoutHomeProfileInput;
};
export type HomeProfileUncheckedCreateWithoutThermostatDevicesInput = {
    id?: number;
    userId: number;
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    insulationThickness: number;
    windowType: string;
    heatingType: string;
    constructionYear: number;
    learningOffset?: number;
    learningConfidence?: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    intervalLearnings?: Prisma.HeatingIntervalLearningUncheckedCreateNestedManyWithoutHomeProfileInput;
};
export type HomeProfileCreateOrConnectWithoutThermostatDevicesInput = {
    where: Prisma.HomeProfileWhereUniqueInput;
    create: Prisma.XOR<Prisma.HomeProfileCreateWithoutThermostatDevicesInput, Prisma.HomeProfileUncheckedCreateWithoutThermostatDevicesInput>;
};
export type HomeProfileUpsertWithoutThermostatDevicesInput = {
    update: Prisma.XOR<Prisma.HomeProfileUpdateWithoutThermostatDevicesInput, Prisma.HomeProfileUncheckedUpdateWithoutThermostatDevicesInput>;
    create: Prisma.XOR<Prisma.HomeProfileCreateWithoutThermostatDevicesInput, Prisma.HomeProfileUncheckedCreateWithoutThermostatDevicesInput>;
    where?: Prisma.HomeProfileWhereInput;
};
export type HomeProfileUpdateToOneWithWhereWithoutThermostatDevicesInput = {
    where?: Prisma.HomeProfileWhereInput;
    data: Prisma.XOR<Prisma.HomeProfileUpdateWithoutThermostatDevicesInput, Prisma.HomeProfileUncheckedUpdateWithoutThermostatDevicesInput>;
};
export type HomeProfileUpdateWithoutThermostatDevicesInput = {
    floorArea?: Prisma.FloatFieldUpdateOperationsInput | number;
    ceilingHeight?: Prisma.FloatFieldUpdateOperationsInput | number;
    insulationType?: Prisma.StringFieldUpdateOperationsInput | string;
    insulationThickness?: Prisma.FloatFieldUpdateOperationsInput | number;
    windowType?: Prisma.StringFieldUpdateOperationsInput | string;
    heatingType?: Prisma.StringFieldUpdateOperationsInput | string;
    constructionYear?: Prisma.IntFieldUpdateOperationsInput | number;
    learningOffset?: Prisma.FloatFieldUpdateOperationsInput | number;
    learningConfidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutHomeProfilesNestedInput;
    intervalLearnings?: Prisma.HeatingIntervalLearningUpdateManyWithoutHomeProfileNestedInput;
};
export type HomeProfileUncheckedUpdateWithoutThermostatDevicesInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    floorArea?: Prisma.FloatFieldUpdateOperationsInput | number;
    ceilingHeight?: Prisma.FloatFieldUpdateOperationsInput | number;
    insulationType?: Prisma.StringFieldUpdateOperationsInput | string;
    insulationThickness?: Prisma.FloatFieldUpdateOperationsInput | number;
    windowType?: Prisma.StringFieldUpdateOperationsInput | string;
    heatingType?: Prisma.StringFieldUpdateOperationsInput | string;
    constructionYear?: Prisma.IntFieldUpdateOperationsInput | number;
    learningOffset?: Prisma.FloatFieldUpdateOperationsInput | number;
    learningConfidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    intervalLearnings?: Prisma.HeatingIntervalLearningUncheckedUpdateManyWithoutHomeProfileNestedInput;
};
export type HomeProfileCreateWithoutIntervalLearningsInput = {
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    insulationThickness: number;
    windowType: string;
    heatingType: string;
    constructionYear: number;
    learningOffset?: number;
    learningConfidence?: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutHomeProfilesInput;
    thermostatDevices?: Prisma.ThermostatDeviceCreateNestedManyWithoutHomeProfileInput;
};
export type HomeProfileUncheckedCreateWithoutIntervalLearningsInput = {
    id?: number;
    userId: number;
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    insulationThickness: number;
    windowType: string;
    heatingType: string;
    constructionYear: number;
    learningOffset?: number;
    learningConfidence?: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedCreateNestedManyWithoutHomeProfileInput;
};
export type HomeProfileCreateOrConnectWithoutIntervalLearningsInput = {
    where: Prisma.HomeProfileWhereUniqueInput;
    create: Prisma.XOR<Prisma.HomeProfileCreateWithoutIntervalLearningsInput, Prisma.HomeProfileUncheckedCreateWithoutIntervalLearningsInput>;
};
export type HomeProfileUpsertWithoutIntervalLearningsInput = {
    update: Prisma.XOR<Prisma.HomeProfileUpdateWithoutIntervalLearningsInput, Prisma.HomeProfileUncheckedUpdateWithoutIntervalLearningsInput>;
    create: Prisma.XOR<Prisma.HomeProfileCreateWithoutIntervalLearningsInput, Prisma.HomeProfileUncheckedCreateWithoutIntervalLearningsInput>;
    where?: Prisma.HomeProfileWhereInput;
};
export type HomeProfileUpdateToOneWithWhereWithoutIntervalLearningsInput = {
    where?: Prisma.HomeProfileWhereInput;
    data: Prisma.XOR<Prisma.HomeProfileUpdateWithoutIntervalLearningsInput, Prisma.HomeProfileUncheckedUpdateWithoutIntervalLearningsInput>;
};
export type HomeProfileUpdateWithoutIntervalLearningsInput = {
    floorArea?: Prisma.FloatFieldUpdateOperationsInput | number;
    ceilingHeight?: Prisma.FloatFieldUpdateOperationsInput | number;
    insulationType?: Prisma.StringFieldUpdateOperationsInput | string;
    insulationThickness?: Prisma.FloatFieldUpdateOperationsInput | number;
    windowType?: Prisma.StringFieldUpdateOperationsInput | string;
    heatingType?: Prisma.StringFieldUpdateOperationsInput | string;
    constructionYear?: Prisma.IntFieldUpdateOperationsInput | number;
    learningOffset?: Prisma.FloatFieldUpdateOperationsInput | number;
    learningConfidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutHomeProfilesNestedInput;
    thermostatDevices?: Prisma.ThermostatDeviceUpdateManyWithoutHomeProfileNestedInput;
};
export type HomeProfileUncheckedUpdateWithoutIntervalLearningsInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    floorArea?: Prisma.FloatFieldUpdateOperationsInput | number;
    ceilingHeight?: Prisma.FloatFieldUpdateOperationsInput | number;
    insulationType?: Prisma.StringFieldUpdateOperationsInput | string;
    insulationThickness?: Prisma.FloatFieldUpdateOperationsInput | number;
    windowType?: Prisma.StringFieldUpdateOperationsInput | string;
    heatingType?: Prisma.StringFieldUpdateOperationsInput | string;
    constructionYear?: Prisma.IntFieldUpdateOperationsInput | number;
    learningOffset?: Prisma.FloatFieldUpdateOperationsInput | number;
    learningConfidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedUpdateManyWithoutHomeProfileNestedInput;
};
export type HomeProfileCreateManyUserInput = {
    id?: number;
    floorArea: number;
    ceilingHeight: number;
    insulationType: string;
    insulationThickness: number;
    windowType: string;
    heatingType: string;
    constructionYear: number;
    learningOffset?: number;
    learningConfidence?: number;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};
export type HomeProfileUpdateWithoutUserInput = {
    floorArea?: Prisma.FloatFieldUpdateOperationsInput | number;
    ceilingHeight?: Prisma.FloatFieldUpdateOperationsInput | number;
    insulationType?: Prisma.StringFieldUpdateOperationsInput | string;
    insulationThickness?: Prisma.FloatFieldUpdateOperationsInput | number;
    windowType?: Prisma.StringFieldUpdateOperationsInput | string;
    heatingType?: Prisma.StringFieldUpdateOperationsInput | string;
    constructionYear?: Prisma.IntFieldUpdateOperationsInput | number;
    learningOffset?: Prisma.FloatFieldUpdateOperationsInput | number;
    learningConfidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceUpdateManyWithoutHomeProfileNestedInput;
    intervalLearnings?: Prisma.HeatingIntervalLearningUpdateManyWithoutHomeProfileNestedInput;
};
export type HomeProfileUncheckedUpdateWithoutUserInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    floorArea?: Prisma.FloatFieldUpdateOperationsInput | number;
    ceilingHeight?: Prisma.FloatFieldUpdateOperationsInput | number;
    insulationType?: Prisma.StringFieldUpdateOperationsInput | string;
    insulationThickness?: Prisma.FloatFieldUpdateOperationsInput | number;
    windowType?: Prisma.StringFieldUpdateOperationsInput | string;
    heatingType?: Prisma.StringFieldUpdateOperationsInput | string;
    constructionYear?: Prisma.IntFieldUpdateOperationsInput | number;
    learningOffset?: Prisma.FloatFieldUpdateOperationsInput | number;
    learningConfidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedUpdateManyWithoutHomeProfileNestedInput;
    intervalLearnings?: Prisma.HeatingIntervalLearningUncheckedUpdateManyWithoutHomeProfileNestedInput;
};
export type HomeProfileUncheckedUpdateManyWithoutUserInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    floorArea?: Prisma.FloatFieldUpdateOperationsInput | number;
    ceilingHeight?: Prisma.FloatFieldUpdateOperationsInput | number;
    insulationType?: Prisma.StringFieldUpdateOperationsInput | string;
    insulationThickness?: Prisma.FloatFieldUpdateOperationsInput | number;
    windowType?: Prisma.StringFieldUpdateOperationsInput | string;
    heatingType?: Prisma.StringFieldUpdateOperationsInput | string;
    constructionYear?: Prisma.IntFieldUpdateOperationsInput | number;
    learningOffset?: Prisma.FloatFieldUpdateOperationsInput | number;
    learningConfidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HomeProfileCountOutputType = {
    thermostatDevices: number;
    intervalLearnings: number;
};
export type HomeProfileCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    thermostatDevices?: boolean | HomeProfileCountOutputTypeCountThermostatDevicesArgs;
    intervalLearnings?: boolean | HomeProfileCountOutputTypeCountIntervalLearningsArgs;
};
export type HomeProfileCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HomeProfileCountOutputTypeSelect<ExtArgs> | null;
};
export type HomeProfileCountOutputTypeCountThermostatDevicesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ThermostatDeviceWhereInput;
};
export type HomeProfileCountOutputTypeCountIntervalLearningsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HeatingIntervalLearningWhereInput;
};
export type HomeProfileSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    userId?: boolean;
    floorArea?: boolean;
    ceilingHeight?: boolean;
    insulationType?: boolean;
    insulationThickness?: boolean;
    windowType?: boolean;
    heatingType?: boolean;
    constructionYear?: boolean;
    learningOffset?: boolean;
    learningConfidence?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
    thermostatDevices?: boolean | Prisma.HomeProfile$thermostatDevicesArgs<ExtArgs>;
    intervalLearnings?: boolean | Prisma.HomeProfile$intervalLearningsArgs<ExtArgs>;
    _count?: boolean | Prisma.HomeProfileCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["homeProfile"]>;
export type HomeProfileSelectScalar = {
    id?: boolean;
    userId?: boolean;
    floorArea?: boolean;
    ceilingHeight?: boolean;
    insulationType?: boolean;
    insulationThickness?: boolean;
    windowType?: boolean;
    heatingType?: boolean;
    constructionYear?: boolean;
    learningOffset?: boolean;
    learningConfidence?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
};
export type HomeProfileOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "userId" | "floorArea" | "ceilingHeight" | "insulationType" | "insulationThickness" | "windowType" | "heatingType" | "constructionYear" | "learningOffset" | "learningConfidence" | "createdAt" | "updatedAt", ExtArgs["result"]["homeProfile"]>;
export type HomeProfileInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
    thermostatDevices?: boolean | Prisma.HomeProfile$thermostatDevicesArgs<ExtArgs>;
    intervalLearnings?: boolean | Prisma.HomeProfile$intervalLearningsArgs<ExtArgs>;
    _count?: boolean | Prisma.HomeProfileCountOutputTypeDefaultArgs<ExtArgs>;
};
export type $HomeProfilePayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "HomeProfile";
    objects: {
        user: Prisma.$UserPayload<ExtArgs>;
        thermostatDevices: Prisma.$ThermostatDevicePayload<ExtArgs>[];
        intervalLearnings: Prisma.$HeatingIntervalLearningPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: number;
        userId: number;
        floorArea: number;
        ceilingHeight: number;
        insulationType: string;
        insulationThickness: number;
        windowType: string;
        heatingType: string;
        constructionYear: number;
        learningOffset: number;
        learningConfidence: number;
        createdAt: Date;
        updatedAt: Date;
    }, ExtArgs["result"]["homeProfile"]>;
    composites: {};
};
export type HomeProfileGetPayload<S extends boolean | null | undefined | HomeProfileDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload, S>;
export type HomeProfileCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<HomeProfileFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: HomeProfileCountAggregateInputType | true;
};
export interface HomeProfileDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['HomeProfile'];
        meta: {
            name: 'HomeProfile';
        };
    };
    findUnique<T extends HomeProfileFindUniqueArgs>(args: Prisma.SelectSubset<T, HomeProfileFindUniqueArgs<ExtArgs>>): Prisma.Prisma__HomeProfileClient<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends HomeProfileFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, HomeProfileFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__HomeProfileClient<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends HomeProfileFindFirstArgs>(args?: Prisma.SelectSubset<T, HomeProfileFindFirstArgs<ExtArgs>>): Prisma.Prisma__HomeProfileClient<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends HomeProfileFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, HomeProfileFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__HomeProfileClient<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends HomeProfileFindManyArgs>(args?: Prisma.SelectSubset<T, HomeProfileFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends HomeProfileCreateArgs>(args: Prisma.SelectSubset<T, HomeProfileCreateArgs<ExtArgs>>): Prisma.Prisma__HomeProfileClient<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends HomeProfileCreateManyArgs>(args?: Prisma.SelectSubset<T, HomeProfileCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends HomeProfileDeleteArgs>(args: Prisma.SelectSubset<T, HomeProfileDeleteArgs<ExtArgs>>): Prisma.Prisma__HomeProfileClient<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends HomeProfileUpdateArgs>(args: Prisma.SelectSubset<T, HomeProfileUpdateArgs<ExtArgs>>): Prisma.Prisma__HomeProfileClient<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends HomeProfileDeleteManyArgs>(args?: Prisma.SelectSubset<T, HomeProfileDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends HomeProfileUpdateManyArgs>(args: Prisma.SelectSubset<T, HomeProfileUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends HomeProfileUpsertArgs>(args: Prisma.SelectSubset<T, HomeProfileUpsertArgs<ExtArgs>>): Prisma.Prisma__HomeProfileClient<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends HomeProfileCountArgs>(args?: Prisma.Subset<T, HomeProfileCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], HomeProfileCountAggregateOutputType> : number>;
    aggregate<T extends HomeProfileAggregateArgs>(args: Prisma.Subset<T, HomeProfileAggregateArgs>): Prisma.PrismaPromise<GetHomeProfileAggregateType<T>>;
    groupBy<T extends HomeProfileGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: HomeProfileGroupByArgs['orderBy'];
    } : {
        orderBy?: HomeProfileGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, HomeProfileGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetHomeProfileGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: HomeProfileFieldRefs;
}
export interface Prisma__HomeProfileClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    user<T extends Prisma.UserDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.UserDefaultArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    thermostatDevices<T extends Prisma.HomeProfile$thermostatDevicesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.HomeProfile$thermostatDevicesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    intervalLearnings<T extends Prisma.HomeProfile$intervalLearningsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.HomeProfile$intervalLearningsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$HeatingIntervalLearningPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface HomeProfileFieldRefs {
    readonly id: Prisma.FieldRef<"HomeProfile", 'Int'>;
    readonly userId: Prisma.FieldRef<"HomeProfile", 'Int'>;
    readonly floorArea: Prisma.FieldRef<"HomeProfile", 'Float'>;
    readonly ceilingHeight: Prisma.FieldRef<"HomeProfile", 'Float'>;
    readonly insulationType: Prisma.FieldRef<"HomeProfile", 'String'>;
    readonly insulationThickness: Prisma.FieldRef<"HomeProfile", 'Float'>;
    readonly windowType: Prisma.FieldRef<"HomeProfile", 'String'>;
    readonly heatingType: Prisma.FieldRef<"HomeProfile", 'String'>;
    readonly constructionYear: Prisma.FieldRef<"HomeProfile", 'Int'>;
    readonly learningOffset: Prisma.FieldRef<"HomeProfile", 'Float'>;
    readonly learningConfidence: Prisma.FieldRef<"HomeProfile", 'Float'>;
    readonly createdAt: Prisma.FieldRef<"HomeProfile", 'DateTime'>;
    readonly updatedAt: Prisma.FieldRef<"HomeProfile", 'DateTime'>;
}
export type HomeProfileFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HomeProfileSelect<ExtArgs> | null;
    omit?: Prisma.HomeProfileOmit<ExtArgs> | null;
    include?: Prisma.HomeProfileInclude<ExtArgs> | null;
    where: Prisma.HomeProfileWhereUniqueInput;
};
export type HomeProfileFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HomeProfileSelect<ExtArgs> | null;
    omit?: Prisma.HomeProfileOmit<ExtArgs> | null;
    include?: Prisma.HomeProfileInclude<ExtArgs> | null;
    where: Prisma.HomeProfileWhereUniqueInput;
};
export type HomeProfileFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HomeProfileSelect<ExtArgs> | null;
    omit?: Prisma.HomeProfileOmit<ExtArgs> | null;
    include?: Prisma.HomeProfileInclude<ExtArgs> | null;
    where?: Prisma.HomeProfileWhereInput;
    orderBy?: Prisma.HomeProfileOrderByWithRelationInput | Prisma.HomeProfileOrderByWithRelationInput[];
    cursor?: Prisma.HomeProfileWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.HomeProfileScalarFieldEnum | Prisma.HomeProfileScalarFieldEnum[];
};
export type HomeProfileFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HomeProfileSelect<ExtArgs> | null;
    omit?: Prisma.HomeProfileOmit<ExtArgs> | null;
    include?: Prisma.HomeProfileInclude<ExtArgs> | null;
    where?: Prisma.HomeProfileWhereInput;
    orderBy?: Prisma.HomeProfileOrderByWithRelationInput | Prisma.HomeProfileOrderByWithRelationInput[];
    cursor?: Prisma.HomeProfileWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.HomeProfileScalarFieldEnum | Prisma.HomeProfileScalarFieldEnum[];
};
export type HomeProfileFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HomeProfileSelect<ExtArgs> | null;
    omit?: Prisma.HomeProfileOmit<ExtArgs> | null;
    include?: Prisma.HomeProfileInclude<ExtArgs> | null;
    where?: Prisma.HomeProfileWhereInput;
    orderBy?: Prisma.HomeProfileOrderByWithRelationInput | Prisma.HomeProfileOrderByWithRelationInput[];
    cursor?: Prisma.HomeProfileWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.HomeProfileScalarFieldEnum | Prisma.HomeProfileScalarFieldEnum[];
};
export type HomeProfileCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HomeProfileSelect<ExtArgs> | null;
    omit?: Prisma.HomeProfileOmit<ExtArgs> | null;
    include?: Prisma.HomeProfileInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.HomeProfileCreateInput, Prisma.HomeProfileUncheckedCreateInput>;
};
export type HomeProfileCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.HomeProfileCreateManyInput | Prisma.HomeProfileCreateManyInput[];
    skipDuplicates?: boolean;
};
export type HomeProfileUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HomeProfileSelect<ExtArgs> | null;
    omit?: Prisma.HomeProfileOmit<ExtArgs> | null;
    include?: Prisma.HomeProfileInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.HomeProfileUpdateInput, Prisma.HomeProfileUncheckedUpdateInput>;
    where: Prisma.HomeProfileWhereUniqueInput;
};
export type HomeProfileUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.HomeProfileUpdateManyMutationInput, Prisma.HomeProfileUncheckedUpdateManyInput>;
    where?: Prisma.HomeProfileWhereInput;
    limit?: number;
};
export type HomeProfileUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HomeProfileSelect<ExtArgs> | null;
    omit?: Prisma.HomeProfileOmit<ExtArgs> | null;
    include?: Prisma.HomeProfileInclude<ExtArgs> | null;
    where: Prisma.HomeProfileWhereUniqueInput;
    create: Prisma.XOR<Prisma.HomeProfileCreateInput, Prisma.HomeProfileUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.HomeProfileUpdateInput, Prisma.HomeProfileUncheckedUpdateInput>;
};
export type HomeProfileDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HomeProfileSelect<ExtArgs> | null;
    omit?: Prisma.HomeProfileOmit<ExtArgs> | null;
    include?: Prisma.HomeProfileInclude<ExtArgs> | null;
    where: Prisma.HomeProfileWhereUniqueInput;
};
export type HomeProfileDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HomeProfileWhereInput;
    limit?: number;
};
export type HomeProfile$thermostatDevicesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type HomeProfile$intervalLearningsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingIntervalLearningSelect<ExtArgs> | null;
    omit?: Prisma.HeatingIntervalLearningOmit<ExtArgs> | null;
    include?: Prisma.HeatingIntervalLearningInclude<ExtArgs> | null;
    where?: Prisma.HeatingIntervalLearningWhereInput;
    orderBy?: Prisma.HeatingIntervalLearningOrderByWithRelationInput | Prisma.HeatingIntervalLearningOrderByWithRelationInput[];
    cursor?: Prisma.HeatingIntervalLearningWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.HeatingIntervalLearningScalarFieldEnum | Prisma.HeatingIntervalLearningScalarFieldEnum[];
};
export type HomeProfileDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HomeProfileSelect<ExtArgs> | null;
    omit?: Prisma.HomeProfileOmit<ExtArgs> | null;
    include?: Prisma.HomeProfileInclude<ExtArgs> | null;
};
export {};
