import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type HeatingIntervalLearningModel = runtime.Types.Result.DefaultSelection<Prisma.$HeatingIntervalLearningPayload>;
export type AggregateHeatingIntervalLearning = {
    _count: HeatingIntervalLearningCountAggregateOutputType | null;
    _avg: HeatingIntervalLearningAvgAggregateOutputType | null;
    _sum: HeatingIntervalLearningSumAggregateOutputType | null;
    _min: HeatingIntervalLearningMinAggregateOutputType | null;
    _max: HeatingIntervalLearningMaxAggregateOutputType | null;
};
export type HeatingIntervalLearningAvgAggregateOutputType = {
    id: number | null;
    homeProfileId: number | null;
    avgReachTimeMin: number | null;
    avgOvershoot: number | null;
    offset: number | null;
    confidence: number | null;
    samples: number | null;
};
export type HeatingIntervalLearningSumAggregateOutputType = {
    id: number | null;
    homeProfileId: number | null;
    avgReachTimeMin: number | null;
    avgOvershoot: number | null;
    offset: number | null;
    confidence: number | null;
    samples: number | null;
};
export type HeatingIntervalLearningMinAggregateOutputType = {
    id: number | null;
    homeProfileId: number | null;
    intervalKey: string | null;
    avgReachTimeMin: number | null;
    avgOvershoot: number | null;
    offset: number | null;
    confidence: number | null;
    samples: number | null;
    lastUpdated: Date | null;
};
export type HeatingIntervalLearningMaxAggregateOutputType = {
    id: number | null;
    homeProfileId: number | null;
    intervalKey: string | null;
    avgReachTimeMin: number | null;
    avgOvershoot: number | null;
    offset: number | null;
    confidence: number | null;
    samples: number | null;
    lastUpdated: Date | null;
};
export type HeatingIntervalLearningCountAggregateOutputType = {
    id: number;
    homeProfileId: number;
    intervalKey: number;
    avgReachTimeMin: number;
    avgOvershoot: number;
    offset: number;
    confidence: number;
    samples: number;
    lastUpdated: number;
    _all: number;
};
export type HeatingIntervalLearningAvgAggregateInputType = {
    id?: true;
    homeProfileId?: true;
    avgReachTimeMin?: true;
    avgOvershoot?: true;
    offset?: true;
    confidence?: true;
    samples?: true;
};
export type HeatingIntervalLearningSumAggregateInputType = {
    id?: true;
    homeProfileId?: true;
    avgReachTimeMin?: true;
    avgOvershoot?: true;
    offset?: true;
    confidence?: true;
    samples?: true;
};
export type HeatingIntervalLearningMinAggregateInputType = {
    id?: true;
    homeProfileId?: true;
    intervalKey?: true;
    avgReachTimeMin?: true;
    avgOvershoot?: true;
    offset?: true;
    confidence?: true;
    samples?: true;
    lastUpdated?: true;
};
export type HeatingIntervalLearningMaxAggregateInputType = {
    id?: true;
    homeProfileId?: true;
    intervalKey?: true;
    avgReachTimeMin?: true;
    avgOvershoot?: true;
    offset?: true;
    confidence?: true;
    samples?: true;
    lastUpdated?: true;
};
export type HeatingIntervalLearningCountAggregateInputType = {
    id?: true;
    homeProfileId?: true;
    intervalKey?: true;
    avgReachTimeMin?: true;
    avgOvershoot?: true;
    offset?: true;
    confidence?: true;
    samples?: true;
    lastUpdated?: true;
    _all?: true;
};
export type HeatingIntervalLearningAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HeatingIntervalLearningWhereInput;
    orderBy?: Prisma.HeatingIntervalLearningOrderByWithRelationInput | Prisma.HeatingIntervalLearningOrderByWithRelationInput[];
    cursor?: Prisma.HeatingIntervalLearningWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | HeatingIntervalLearningCountAggregateInputType;
    _avg?: HeatingIntervalLearningAvgAggregateInputType;
    _sum?: HeatingIntervalLearningSumAggregateInputType;
    _min?: HeatingIntervalLearningMinAggregateInputType;
    _max?: HeatingIntervalLearningMaxAggregateInputType;
};
export type GetHeatingIntervalLearningAggregateType<T extends HeatingIntervalLearningAggregateArgs> = {
    [P in keyof T & keyof AggregateHeatingIntervalLearning]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateHeatingIntervalLearning[P]> : Prisma.GetScalarType<T[P], AggregateHeatingIntervalLearning[P]>;
};
export type HeatingIntervalLearningGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HeatingIntervalLearningWhereInput;
    orderBy?: Prisma.HeatingIntervalLearningOrderByWithAggregationInput | Prisma.HeatingIntervalLearningOrderByWithAggregationInput[];
    by: Prisma.HeatingIntervalLearningScalarFieldEnum[] | Prisma.HeatingIntervalLearningScalarFieldEnum;
    having?: Prisma.HeatingIntervalLearningScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: HeatingIntervalLearningCountAggregateInputType | true;
    _avg?: HeatingIntervalLearningAvgAggregateInputType;
    _sum?: HeatingIntervalLearningSumAggregateInputType;
    _min?: HeatingIntervalLearningMinAggregateInputType;
    _max?: HeatingIntervalLearningMaxAggregateInputType;
};
export type HeatingIntervalLearningGroupByOutputType = {
    id: number;
    homeProfileId: number;
    intervalKey: string;
    avgReachTimeMin: number;
    avgOvershoot: number;
    offset: number;
    confidence: number;
    samples: number;
    lastUpdated: Date;
    _count: HeatingIntervalLearningCountAggregateOutputType | null;
    _avg: HeatingIntervalLearningAvgAggregateOutputType | null;
    _sum: HeatingIntervalLearningSumAggregateOutputType | null;
    _min: HeatingIntervalLearningMinAggregateOutputType | null;
    _max: HeatingIntervalLearningMaxAggregateOutputType | null;
};
type GetHeatingIntervalLearningGroupByPayload<T extends HeatingIntervalLearningGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<HeatingIntervalLearningGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof HeatingIntervalLearningGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], HeatingIntervalLearningGroupByOutputType[P]> : Prisma.GetScalarType<T[P], HeatingIntervalLearningGroupByOutputType[P]>;
}>>;
export type HeatingIntervalLearningWhereInput = {
    AND?: Prisma.HeatingIntervalLearningWhereInput | Prisma.HeatingIntervalLearningWhereInput[];
    OR?: Prisma.HeatingIntervalLearningWhereInput[];
    NOT?: Prisma.HeatingIntervalLearningWhereInput | Prisma.HeatingIntervalLearningWhereInput[];
    id?: Prisma.IntFilter<"HeatingIntervalLearning"> | number;
    homeProfileId?: Prisma.IntFilter<"HeatingIntervalLearning"> | number;
    intervalKey?: Prisma.StringFilter<"HeatingIntervalLearning"> | string;
    avgReachTimeMin?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    avgOvershoot?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    offset?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    confidence?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    samples?: Prisma.IntFilter<"HeatingIntervalLearning"> | number;
    lastUpdated?: Prisma.DateTimeFilter<"HeatingIntervalLearning"> | Date | string;
    homeProfile?: Prisma.XOR<Prisma.HomeProfileScalarRelationFilter, Prisma.HomeProfileWhereInput>;
};
export type HeatingIntervalLearningOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    intervalKey?: Prisma.SortOrder;
    avgReachTimeMin?: Prisma.SortOrder;
    avgOvershoot?: Prisma.SortOrder;
    offset?: Prisma.SortOrder;
    confidence?: Prisma.SortOrder;
    samples?: Prisma.SortOrder;
    lastUpdated?: Prisma.SortOrder;
    homeProfile?: Prisma.HomeProfileOrderByWithRelationInput;
    _relevance?: Prisma.HeatingIntervalLearningOrderByRelevanceInput;
};
export type HeatingIntervalLearningWhereUniqueInput = Prisma.AtLeast<{
    id?: number;
    homeProfileId_intervalKey?: Prisma.HeatingIntervalLearningHomeProfileIdIntervalKeyCompoundUniqueInput;
    AND?: Prisma.HeatingIntervalLearningWhereInput | Prisma.HeatingIntervalLearningWhereInput[];
    OR?: Prisma.HeatingIntervalLearningWhereInput[];
    NOT?: Prisma.HeatingIntervalLearningWhereInput | Prisma.HeatingIntervalLearningWhereInput[];
    homeProfileId?: Prisma.IntFilter<"HeatingIntervalLearning"> | number;
    intervalKey?: Prisma.StringFilter<"HeatingIntervalLearning"> | string;
    avgReachTimeMin?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    avgOvershoot?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    offset?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    confidence?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    samples?: Prisma.IntFilter<"HeatingIntervalLearning"> | number;
    lastUpdated?: Prisma.DateTimeFilter<"HeatingIntervalLearning"> | Date | string;
    homeProfile?: Prisma.XOR<Prisma.HomeProfileScalarRelationFilter, Prisma.HomeProfileWhereInput>;
}, "id" | "homeProfileId_intervalKey">;
export type HeatingIntervalLearningOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    intervalKey?: Prisma.SortOrder;
    avgReachTimeMin?: Prisma.SortOrder;
    avgOvershoot?: Prisma.SortOrder;
    offset?: Prisma.SortOrder;
    confidence?: Prisma.SortOrder;
    samples?: Prisma.SortOrder;
    lastUpdated?: Prisma.SortOrder;
    _count?: Prisma.HeatingIntervalLearningCountOrderByAggregateInput;
    _avg?: Prisma.HeatingIntervalLearningAvgOrderByAggregateInput;
    _max?: Prisma.HeatingIntervalLearningMaxOrderByAggregateInput;
    _min?: Prisma.HeatingIntervalLearningMinOrderByAggregateInput;
    _sum?: Prisma.HeatingIntervalLearningSumOrderByAggregateInput;
};
export type HeatingIntervalLearningScalarWhereWithAggregatesInput = {
    AND?: Prisma.HeatingIntervalLearningScalarWhereWithAggregatesInput | Prisma.HeatingIntervalLearningScalarWhereWithAggregatesInput[];
    OR?: Prisma.HeatingIntervalLearningScalarWhereWithAggregatesInput[];
    NOT?: Prisma.HeatingIntervalLearningScalarWhereWithAggregatesInput | Prisma.HeatingIntervalLearningScalarWhereWithAggregatesInput[];
    id?: Prisma.IntWithAggregatesFilter<"HeatingIntervalLearning"> | number;
    homeProfileId?: Prisma.IntWithAggregatesFilter<"HeatingIntervalLearning"> | number;
    intervalKey?: Prisma.StringWithAggregatesFilter<"HeatingIntervalLearning"> | string;
    avgReachTimeMin?: Prisma.FloatWithAggregatesFilter<"HeatingIntervalLearning"> | number;
    avgOvershoot?: Prisma.FloatWithAggregatesFilter<"HeatingIntervalLearning"> | number;
    offset?: Prisma.FloatWithAggregatesFilter<"HeatingIntervalLearning"> | number;
    confidence?: Prisma.FloatWithAggregatesFilter<"HeatingIntervalLearning"> | number;
    samples?: Prisma.IntWithAggregatesFilter<"HeatingIntervalLearning"> | number;
    lastUpdated?: Prisma.DateTimeWithAggregatesFilter<"HeatingIntervalLearning"> | Date | string;
};
export type HeatingIntervalLearningCreateInput = {
    intervalKey: string;
    avgReachTimeMin: number;
    avgOvershoot: number;
    offset?: number;
    confidence?: number;
    samples?: number;
    lastUpdated?: Date | string;
    homeProfile: Prisma.HomeProfileCreateNestedOneWithoutIntervalLearningsInput;
};
export type HeatingIntervalLearningUncheckedCreateInput = {
    id?: number;
    homeProfileId: number;
    intervalKey: string;
    avgReachTimeMin: number;
    avgOvershoot: number;
    offset?: number;
    confidence?: number;
    samples?: number;
    lastUpdated?: Date | string;
};
export type HeatingIntervalLearningUpdateInput = {
    intervalKey?: Prisma.StringFieldUpdateOperationsInput | string;
    avgReachTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    avgOvershoot?: Prisma.FloatFieldUpdateOperationsInput | number;
    offset?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    samples?: Prisma.IntFieldUpdateOperationsInput | number;
    lastUpdated?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    homeProfile?: Prisma.HomeProfileUpdateOneRequiredWithoutIntervalLearningsNestedInput;
};
export type HeatingIntervalLearningUncheckedUpdateInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    homeProfileId?: Prisma.IntFieldUpdateOperationsInput | number;
    intervalKey?: Prisma.StringFieldUpdateOperationsInput | string;
    avgReachTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    avgOvershoot?: Prisma.FloatFieldUpdateOperationsInput | number;
    offset?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    samples?: Prisma.IntFieldUpdateOperationsInput | number;
    lastUpdated?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingIntervalLearningCreateManyInput = {
    id?: number;
    homeProfileId: number;
    intervalKey: string;
    avgReachTimeMin: number;
    avgOvershoot: number;
    offset?: number;
    confidence?: number;
    samples?: number;
    lastUpdated?: Date | string;
};
export type HeatingIntervalLearningUpdateManyMutationInput = {
    intervalKey?: Prisma.StringFieldUpdateOperationsInput | string;
    avgReachTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    avgOvershoot?: Prisma.FloatFieldUpdateOperationsInput | number;
    offset?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    samples?: Prisma.IntFieldUpdateOperationsInput | number;
    lastUpdated?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingIntervalLearningUncheckedUpdateManyInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    homeProfileId?: Prisma.IntFieldUpdateOperationsInput | number;
    intervalKey?: Prisma.StringFieldUpdateOperationsInput | string;
    avgReachTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    avgOvershoot?: Prisma.FloatFieldUpdateOperationsInput | number;
    offset?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    samples?: Prisma.IntFieldUpdateOperationsInput | number;
    lastUpdated?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingIntervalLearningListRelationFilter = {
    every?: Prisma.HeatingIntervalLearningWhereInput;
    some?: Prisma.HeatingIntervalLearningWhereInput;
    none?: Prisma.HeatingIntervalLearningWhereInput;
};
export type HeatingIntervalLearningOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type HeatingIntervalLearningOrderByRelevanceInput = {
    fields: Prisma.HeatingIntervalLearningOrderByRelevanceFieldEnum | Prisma.HeatingIntervalLearningOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type HeatingIntervalLearningHomeProfileIdIntervalKeyCompoundUniqueInput = {
    homeProfileId: number;
    intervalKey: string;
};
export type HeatingIntervalLearningCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    intervalKey?: Prisma.SortOrder;
    avgReachTimeMin?: Prisma.SortOrder;
    avgOvershoot?: Prisma.SortOrder;
    offset?: Prisma.SortOrder;
    confidence?: Prisma.SortOrder;
    samples?: Prisma.SortOrder;
    lastUpdated?: Prisma.SortOrder;
};
export type HeatingIntervalLearningAvgOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    avgReachTimeMin?: Prisma.SortOrder;
    avgOvershoot?: Prisma.SortOrder;
    offset?: Prisma.SortOrder;
    confidence?: Prisma.SortOrder;
    samples?: Prisma.SortOrder;
};
export type HeatingIntervalLearningMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    intervalKey?: Prisma.SortOrder;
    avgReachTimeMin?: Prisma.SortOrder;
    avgOvershoot?: Prisma.SortOrder;
    offset?: Prisma.SortOrder;
    confidence?: Prisma.SortOrder;
    samples?: Prisma.SortOrder;
    lastUpdated?: Prisma.SortOrder;
};
export type HeatingIntervalLearningMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    intervalKey?: Prisma.SortOrder;
    avgReachTimeMin?: Prisma.SortOrder;
    avgOvershoot?: Prisma.SortOrder;
    offset?: Prisma.SortOrder;
    confidence?: Prisma.SortOrder;
    samples?: Prisma.SortOrder;
    lastUpdated?: Prisma.SortOrder;
};
export type HeatingIntervalLearningSumOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    homeProfileId?: Prisma.SortOrder;
    avgReachTimeMin?: Prisma.SortOrder;
    avgOvershoot?: Prisma.SortOrder;
    offset?: Prisma.SortOrder;
    confidence?: Prisma.SortOrder;
    samples?: Prisma.SortOrder;
};
export type HeatingIntervalLearningCreateNestedManyWithoutHomeProfileInput = {
    create?: Prisma.XOR<Prisma.HeatingIntervalLearningCreateWithoutHomeProfileInput, Prisma.HeatingIntervalLearningUncheckedCreateWithoutHomeProfileInput> | Prisma.HeatingIntervalLearningCreateWithoutHomeProfileInput[] | Prisma.HeatingIntervalLearningUncheckedCreateWithoutHomeProfileInput[];
    connectOrCreate?: Prisma.HeatingIntervalLearningCreateOrConnectWithoutHomeProfileInput | Prisma.HeatingIntervalLearningCreateOrConnectWithoutHomeProfileInput[];
    createMany?: Prisma.HeatingIntervalLearningCreateManyHomeProfileInputEnvelope;
    connect?: Prisma.HeatingIntervalLearningWhereUniqueInput | Prisma.HeatingIntervalLearningWhereUniqueInput[];
};
export type HeatingIntervalLearningUncheckedCreateNestedManyWithoutHomeProfileInput = {
    create?: Prisma.XOR<Prisma.HeatingIntervalLearningCreateWithoutHomeProfileInput, Prisma.HeatingIntervalLearningUncheckedCreateWithoutHomeProfileInput> | Prisma.HeatingIntervalLearningCreateWithoutHomeProfileInput[] | Prisma.HeatingIntervalLearningUncheckedCreateWithoutHomeProfileInput[];
    connectOrCreate?: Prisma.HeatingIntervalLearningCreateOrConnectWithoutHomeProfileInput | Prisma.HeatingIntervalLearningCreateOrConnectWithoutHomeProfileInput[];
    createMany?: Prisma.HeatingIntervalLearningCreateManyHomeProfileInputEnvelope;
    connect?: Prisma.HeatingIntervalLearningWhereUniqueInput | Prisma.HeatingIntervalLearningWhereUniqueInput[];
};
export type HeatingIntervalLearningUpdateManyWithoutHomeProfileNestedInput = {
    create?: Prisma.XOR<Prisma.HeatingIntervalLearningCreateWithoutHomeProfileInput, Prisma.HeatingIntervalLearningUncheckedCreateWithoutHomeProfileInput> | Prisma.HeatingIntervalLearningCreateWithoutHomeProfileInput[] | Prisma.HeatingIntervalLearningUncheckedCreateWithoutHomeProfileInput[];
    connectOrCreate?: Prisma.HeatingIntervalLearningCreateOrConnectWithoutHomeProfileInput | Prisma.HeatingIntervalLearningCreateOrConnectWithoutHomeProfileInput[];
    upsert?: Prisma.HeatingIntervalLearningUpsertWithWhereUniqueWithoutHomeProfileInput | Prisma.HeatingIntervalLearningUpsertWithWhereUniqueWithoutHomeProfileInput[];
    createMany?: Prisma.HeatingIntervalLearningCreateManyHomeProfileInputEnvelope;
    set?: Prisma.HeatingIntervalLearningWhereUniqueInput | Prisma.HeatingIntervalLearningWhereUniqueInput[];
    disconnect?: Prisma.HeatingIntervalLearningWhereUniqueInput | Prisma.HeatingIntervalLearningWhereUniqueInput[];
    delete?: Prisma.HeatingIntervalLearningWhereUniqueInput | Prisma.HeatingIntervalLearningWhereUniqueInput[];
    connect?: Prisma.HeatingIntervalLearningWhereUniqueInput | Prisma.HeatingIntervalLearningWhereUniqueInput[];
    update?: Prisma.HeatingIntervalLearningUpdateWithWhereUniqueWithoutHomeProfileInput | Prisma.HeatingIntervalLearningUpdateWithWhereUniqueWithoutHomeProfileInput[];
    updateMany?: Prisma.HeatingIntervalLearningUpdateManyWithWhereWithoutHomeProfileInput | Prisma.HeatingIntervalLearningUpdateManyWithWhereWithoutHomeProfileInput[];
    deleteMany?: Prisma.HeatingIntervalLearningScalarWhereInput | Prisma.HeatingIntervalLearningScalarWhereInput[];
};
export type HeatingIntervalLearningUncheckedUpdateManyWithoutHomeProfileNestedInput = {
    create?: Prisma.XOR<Prisma.HeatingIntervalLearningCreateWithoutHomeProfileInput, Prisma.HeatingIntervalLearningUncheckedCreateWithoutHomeProfileInput> | Prisma.HeatingIntervalLearningCreateWithoutHomeProfileInput[] | Prisma.HeatingIntervalLearningUncheckedCreateWithoutHomeProfileInput[];
    connectOrCreate?: Prisma.HeatingIntervalLearningCreateOrConnectWithoutHomeProfileInput | Prisma.HeatingIntervalLearningCreateOrConnectWithoutHomeProfileInput[];
    upsert?: Prisma.HeatingIntervalLearningUpsertWithWhereUniqueWithoutHomeProfileInput | Prisma.HeatingIntervalLearningUpsertWithWhereUniqueWithoutHomeProfileInput[];
    createMany?: Prisma.HeatingIntervalLearningCreateManyHomeProfileInputEnvelope;
    set?: Prisma.HeatingIntervalLearningWhereUniqueInput | Prisma.HeatingIntervalLearningWhereUniqueInput[];
    disconnect?: Prisma.HeatingIntervalLearningWhereUniqueInput | Prisma.HeatingIntervalLearningWhereUniqueInput[];
    delete?: Prisma.HeatingIntervalLearningWhereUniqueInput | Prisma.HeatingIntervalLearningWhereUniqueInput[];
    connect?: Prisma.HeatingIntervalLearningWhereUniqueInput | Prisma.HeatingIntervalLearningWhereUniqueInput[];
    update?: Prisma.HeatingIntervalLearningUpdateWithWhereUniqueWithoutHomeProfileInput | Prisma.HeatingIntervalLearningUpdateWithWhereUniqueWithoutHomeProfileInput[];
    updateMany?: Prisma.HeatingIntervalLearningUpdateManyWithWhereWithoutHomeProfileInput | Prisma.HeatingIntervalLearningUpdateManyWithWhereWithoutHomeProfileInput[];
    deleteMany?: Prisma.HeatingIntervalLearningScalarWhereInput | Prisma.HeatingIntervalLearningScalarWhereInput[];
};
export type HeatingIntervalLearningCreateWithoutHomeProfileInput = {
    intervalKey: string;
    avgReachTimeMin: number;
    avgOvershoot: number;
    offset?: number;
    confidence?: number;
    samples?: number;
    lastUpdated?: Date | string;
};
export type HeatingIntervalLearningUncheckedCreateWithoutHomeProfileInput = {
    id?: number;
    intervalKey: string;
    avgReachTimeMin: number;
    avgOvershoot: number;
    offset?: number;
    confidence?: number;
    samples?: number;
    lastUpdated?: Date | string;
};
export type HeatingIntervalLearningCreateOrConnectWithoutHomeProfileInput = {
    where: Prisma.HeatingIntervalLearningWhereUniqueInput;
    create: Prisma.XOR<Prisma.HeatingIntervalLearningCreateWithoutHomeProfileInput, Prisma.HeatingIntervalLearningUncheckedCreateWithoutHomeProfileInput>;
};
export type HeatingIntervalLearningCreateManyHomeProfileInputEnvelope = {
    data: Prisma.HeatingIntervalLearningCreateManyHomeProfileInput | Prisma.HeatingIntervalLearningCreateManyHomeProfileInput[];
    skipDuplicates?: boolean;
};
export type HeatingIntervalLearningUpsertWithWhereUniqueWithoutHomeProfileInput = {
    where: Prisma.HeatingIntervalLearningWhereUniqueInput;
    update: Prisma.XOR<Prisma.HeatingIntervalLearningUpdateWithoutHomeProfileInput, Prisma.HeatingIntervalLearningUncheckedUpdateWithoutHomeProfileInput>;
    create: Prisma.XOR<Prisma.HeatingIntervalLearningCreateWithoutHomeProfileInput, Prisma.HeatingIntervalLearningUncheckedCreateWithoutHomeProfileInput>;
};
export type HeatingIntervalLearningUpdateWithWhereUniqueWithoutHomeProfileInput = {
    where: Prisma.HeatingIntervalLearningWhereUniqueInput;
    data: Prisma.XOR<Prisma.HeatingIntervalLearningUpdateWithoutHomeProfileInput, Prisma.HeatingIntervalLearningUncheckedUpdateWithoutHomeProfileInput>;
};
export type HeatingIntervalLearningUpdateManyWithWhereWithoutHomeProfileInput = {
    where: Prisma.HeatingIntervalLearningScalarWhereInput;
    data: Prisma.XOR<Prisma.HeatingIntervalLearningUpdateManyMutationInput, Prisma.HeatingIntervalLearningUncheckedUpdateManyWithoutHomeProfileInput>;
};
export type HeatingIntervalLearningScalarWhereInput = {
    AND?: Prisma.HeatingIntervalLearningScalarWhereInput | Prisma.HeatingIntervalLearningScalarWhereInput[];
    OR?: Prisma.HeatingIntervalLearningScalarWhereInput[];
    NOT?: Prisma.HeatingIntervalLearningScalarWhereInput | Prisma.HeatingIntervalLearningScalarWhereInput[];
    id?: Prisma.IntFilter<"HeatingIntervalLearning"> | number;
    homeProfileId?: Prisma.IntFilter<"HeatingIntervalLearning"> | number;
    intervalKey?: Prisma.StringFilter<"HeatingIntervalLearning"> | string;
    avgReachTimeMin?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    avgOvershoot?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    offset?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    confidence?: Prisma.FloatFilter<"HeatingIntervalLearning"> | number;
    samples?: Prisma.IntFilter<"HeatingIntervalLearning"> | number;
    lastUpdated?: Prisma.DateTimeFilter<"HeatingIntervalLearning"> | Date | string;
};
export type HeatingIntervalLearningCreateManyHomeProfileInput = {
    id?: number;
    intervalKey: string;
    avgReachTimeMin: number;
    avgOvershoot: number;
    offset?: number;
    confidence?: number;
    samples?: number;
    lastUpdated?: Date | string;
};
export type HeatingIntervalLearningUpdateWithoutHomeProfileInput = {
    intervalKey?: Prisma.StringFieldUpdateOperationsInput | string;
    avgReachTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    avgOvershoot?: Prisma.FloatFieldUpdateOperationsInput | number;
    offset?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    samples?: Prisma.IntFieldUpdateOperationsInput | number;
    lastUpdated?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingIntervalLearningUncheckedUpdateWithoutHomeProfileInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    intervalKey?: Prisma.StringFieldUpdateOperationsInput | string;
    avgReachTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    avgOvershoot?: Prisma.FloatFieldUpdateOperationsInput | number;
    offset?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    samples?: Prisma.IntFieldUpdateOperationsInput | number;
    lastUpdated?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingIntervalLearningUncheckedUpdateManyWithoutHomeProfileInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    intervalKey?: Prisma.StringFieldUpdateOperationsInput | string;
    avgReachTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    avgOvershoot?: Prisma.FloatFieldUpdateOperationsInput | number;
    offset?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidence?: Prisma.FloatFieldUpdateOperationsInput | number;
    samples?: Prisma.IntFieldUpdateOperationsInput | number;
    lastUpdated?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type HeatingIntervalLearningSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    homeProfileId?: boolean;
    intervalKey?: boolean;
    avgReachTimeMin?: boolean;
    avgOvershoot?: boolean;
    offset?: boolean;
    confidence?: boolean;
    samples?: boolean;
    lastUpdated?: boolean;
    homeProfile?: boolean | Prisma.HomeProfileDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["heatingIntervalLearning"]>;
export type HeatingIntervalLearningSelectScalar = {
    id?: boolean;
    homeProfileId?: boolean;
    intervalKey?: boolean;
    avgReachTimeMin?: boolean;
    avgOvershoot?: boolean;
    offset?: boolean;
    confidence?: boolean;
    samples?: boolean;
    lastUpdated?: boolean;
};
export type HeatingIntervalLearningOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "homeProfileId" | "intervalKey" | "avgReachTimeMin" | "avgOvershoot" | "offset" | "confidence" | "samples" | "lastUpdated", ExtArgs["result"]["heatingIntervalLearning"]>;
export type HeatingIntervalLearningInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    homeProfile?: boolean | Prisma.HomeProfileDefaultArgs<ExtArgs>;
};
export type $HeatingIntervalLearningPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "HeatingIntervalLearning";
    objects: {
        homeProfile: Prisma.$HomeProfilePayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: number;
        homeProfileId: number;
        intervalKey: string;
        avgReachTimeMin: number;
        avgOvershoot: number;
        offset: number;
        confidence: number;
        samples: number;
        lastUpdated: Date;
    }, ExtArgs["result"]["heatingIntervalLearning"]>;
    composites: {};
};
export type HeatingIntervalLearningGetPayload<S extends boolean | null | undefined | HeatingIntervalLearningDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$HeatingIntervalLearningPayload, S>;
export type HeatingIntervalLearningCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<HeatingIntervalLearningFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: HeatingIntervalLearningCountAggregateInputType | true;
};
export interface HeatingIntervalLearningDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['HeatingIntervalLearning'];
        meta: {
            name: 'HeatingIntervalLearning';
        };
    };
    findUnique<T extends HeatingIntervalLearningFindUniqueArgs>(args: Prisma.SelectSubset<T, HeatingIntervalLearningFindUniqueArgs<ExtArgs>>): Prisma.Prisma__HeatingIntervalLearningClient<runtime.Types.Result.GetResult<Prisma.$HeatingIntervalLearningPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends HeatingIntervalLearningFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, HeatingIntervalLearningFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__HeatingIntervalLearningClient<runtime.Types.Result.GetResult<Prisma.$HeatingIntervalLearningPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends HeatingIntervalLearningFindFirstArgs>(args?: Prisma.SelectSubset<T, HeatingIntervalLearningFindFirstArgs<ExtArgs>>): Prisma.Prisma__HeatingIntervalLearningClient<runtime.Types.Result.GetResult<Prisma.$HeatingIntervalLearningPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends HeatingIntervalLearningFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, HeatingIntervalLearningFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__HeatingIntervalLearningClient<runtime.Types.Result.GetResult<Prisma.$HeatingIntervalLearningPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends HeatingIntervalLearningFindManyArgs>(args?: Prisma.SelectSubset<T, HeatingIntervalLearningFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$HeatingIntervalLearningPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends HeatingIntervalLearningCreateArgs>(args: Prisma.SelectSubset<T, HeatingIntervalLearningCreateArgs<ExtArgs>>): Prisma.Prisma__HeatingIntervalLearningClient<runtime.Types.Result.GetResult<Prisma.$HeatingIntervalLearningPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends HeatingIntervalLearningCreateManyArgs>(args?: Prisma.SelectSubset<T, HeatingIntervalLearningCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends HeatingIntervalLearningDeleteArgs>(args: Prisma.SelectSubset<T, HeatingIntervalLearningDeleteArgs<ExtArgs>>): Prisma.Prisma__HeatingIntervalLearningClient<runtime.Types.Result.GetResult<Prisma.$HeatingIntervalLearningPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends HeatingIntervalLearningUpdateArgs>(args: Prisma.SelectSubset<T, HeatingIntervalLearningUpdateArgs<ExtArgs>>): Prisma.Prisma__HeatingIntervalLearningClient<runtime.Types.Result.GetResult<Prisma.$HeatingIntervalLearningPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends HeatingIntervalLearningDeleteManyArgs>(args?: Prisma.SelectSubset<T, HeatingIntervalLearningDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends HeatingIntervalLearningUpdateManyArgs>(args: Prisma.SelectSubset<T, HeatingIntervalLearningUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends HeatingIntervalLearningUpsertArgs>(args: Prisma.SelectSubset<T, HeatingIntervalLearningUpsertArgs<ExtArgs>>): Prisma.Prisma__HeatingIntervalLearningClient<runtime.Types.Result.GetResult<Prisma.$HeatingIntervalLearningPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends HeatingIntervalLearningCountArgs>(args?: Prisma.Subset<T, HeatingIntervalLearningCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], HeatingIntervalLearningCountAggregateOutputType> : number>;
    aggregate<T extends HeatingIntervalLearningAggregateArgs>(args: Prisma.Subset<T, HeatingIntervalLearningAggregateArgs>): Prisma.PrismaPromise<GetHeatingIntervalLearningAggregateType<T>>;
    groupBy<T extends HeatingIntervalLearningGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: HeatingIntervalLearningGroupByArgs['orderBy'];
    } : {
        orderBy?: HeatingIntervalLearningGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, HeatingIntervalLearningGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetHeatingIntervalLearningGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: HeatingIntervalLearningFieldRefs;
}
export interface Prisma__HeatingIntervalLearningClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    homeProfile<T extends Prisma.HomeProfileDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.HomeProfileDefaultArgs<ExtArgs>>): Prisma.Prisma__HomeProfileClient<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface HeatingIntervalLearningFieldRefs {
    readonly id: Prisma.FieldRef<"HeatingIntervalLearning", 'Int'>;
    readonly homeProfileId: Prisma.FieldRef<"HeatingIntervalLearning", 'Int'>;
    readonly intervalKey: Prisma.FieldRef<"HeatingIntervalLearning", 'String'>;
    readonly avgReachTimeMin: Prisma.FieldRef<"HeatingIntervalLearning", 'Float'>;
    readonly avgOvershoot: Prisma.FieldRef<"HeatingIntervalLearning", 'Float'>;
    readonly offset: Prisma.FieldRef<"HeatingIntervalLearning", 'Float'>;
    readonly confidence: Prisma.FieldRef<"HeatingIntervalLearning", 'Float'>;
    readonly samples: Prisma.FieldRef<"HeatingIntervalLearning", 'Int'>;
    readonly lastUpdated: Prisma.FieldRef<"HeatingIntervalLearning", 'DateTime'>;
}
export type HeatingIntervalLearningFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingIntervalLearningSelect<ExtArgs> | null;
    omit?: Prisma.HeatingIntervalLearningOmit<ExtArgs> | null;
    include?: Prisma.HeatingIntervalLearningInclude<ExtArgs> | null;
    where: Prisma.HeatingIntervalLearningWhereUniqueInput;
};
export type HeatingIntervalLearningFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingIntervalLearningSelect<ExtArgs> | null;
    omit?: Prisma.HeatingIntervalLearningOmit<ExtArgs> | null;
    include?: Prisma.HeatingIntervalLearningInclude<ExtArgs> | null;
    where: Prisma.HeatingIntervalLearningWhereUniqueInput;
};
export type HeatingIntervalLearningFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type HeatingIntervalLearningFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type HeatingIntervalLearningFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type HeatingIntervalLearningCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingIntervalLearningSelect<ExtArgs> | null;
    omit?: Prisma.HeatingIntervalLearningOmit<ExtArgs> | null;
    include?: Prisma.HeatingIntervalLearningInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.HeatingIntervalLearningCreateInput, Prisma.HeatingIntervalLearningUncheckedCreateInput>;
};
export type HeatingIntervalLearningCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.HeatingIntervalLearningCreateManyInput | Prisma.HeatingIntervalLearningCreateManyInput[];
    skipDuplicates?: boolean;
};
export type HeatingIntervalLearningUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingIntervalLearningSelect<ExtArgs> | null;
    omit?: Prisma.HeatingIntervalLearningOmit<ExtArgs> | null;
    include?: Prisma.HeatingIntervalLearningInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.HeatingIntervalLearningUpdateInput, Prisma.HeatingIntervalLearningUncheckedUpdateInput>;
    where: Prisma.HeatingIntervalLearningWhereUniqueInput;
};
export type HeatingIntervalLearningUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.HeatingIntervalLearningUpdateManyMutationInput, Prisma.HeatingIntervalLearningUncheckedUpdateManyInput>;
    where?: Prisma.HeatingIntervalLearningWhereInput;
    limit?: number;
};
export type HeatingIntervalLearningUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingIntervalLearningSelect<ExtArgs> | null;
    omit?: Prisma.HeatingIntervalLearningOmit<ExtArgs> | null;
    include?: Prisma.HeatingIntervalLearningInclude<ExtArgs> | null;
    where: Prisma.HeatingIntervalLearningWhereUniqueInput;
    create: Prisma.XOR<Prisma.HeatingIntervalLearningCreateInput, Prisma.HeatingIntervalLearningUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.HeatingIntervalLearningUpdateInput, Prisma.HeatingIntervalLearningUncheckedUpdateInput>;
};
export type HeatingIntervalLearningDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingIntervalLearningSelect<ExtArgs> | null;
    omit?: Prisma.HeatingIntervalLearningOmit<ExtArgs> | null;
    include?: Prisma.HeatingIntervalLearningInclude<ExtArgs> | null;
    where: Prisma.HeatingIntervalLearningWhereUniqueInput;
};
export type HeatingIntervalLearningDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HeatingIntervalLearningWhereInput;
    limit?: number;
};
export type HeatingIntervalLearningDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.HeatingIntervalLearningSelect<ExtArgs> | null;
    omit?: Prisma.HeatingIntervalLearningOmit<ExtArgs> | null;
    include?: Prisma.HeatingIntervalLearningInclude<ExtArgs> | null;
};
export {};
