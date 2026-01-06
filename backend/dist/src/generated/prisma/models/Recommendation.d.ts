import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type RecommendationModel = runtime.Types.Result.DefaultSelection<Prisma.$RecommendationPayload>;
export type AggregateRecommendation = {
    _count: RecommendationCountAggregateOutputType | null;
    _avg: RecommendationAvgAggregateOutputType | null;
    _sum: RecommendationSumAggregateOutputType | null;
    _min: RecommendationMinAggregateOutputType | null;
    _max: RecommendationMaxAggregateOutputType | null;
};
export type RecommendationAvgAggregateOutputType = {
    id: number | null;
    userId: number | null;
    recommendedFlowTemp: number | null;
    expectedHeatTimeMin: number | null;
    confidenceScore: number | null;
};
export type RecommendationSumAggregateOutputType = {
    id: number | null;
    userId: number | null;
    recommendedFlowTemp: number | null;
    expectedHeatTimeMin: number | null;
    confidenceScore: number | null;
};
export type RecommendationMinAggregateOutputType = {
    id: number | null;
    userId: number | null;
    date: Date | null;
    recommendedFlowTemp: number | null;
    expectedHeatTimeMin: number | null;
    confidenceScore: number | null;
    createdAt: Date | null;
};
export type RecommendationMaxAggregateOutputType = {
    id: number | null;
    userId: number | null;
    date: Date | null;
    recommendedFlowTemp: number | null;
    expectedHeatTimeMin: number | null;
    confidenceScore: number | null;
    createdAt: Date | null;
};
export type RecommendationCountAggregateOutputType = {
    id: number;
    userId: number;
    date: number;
    recommendedFlowTemp: number;
    expectedHeatTimeMin: number;
    confidenceScore: number;
    createdAt: number;
    _all: number;
};
export type RecommendationAvgAggregateInputType = {
    id?: true;
    userId?: true;
    recommendedFlowTemp?: true;
    expectedHeatTimeMin?: true;
    confidenceScore?: true;
};
export type RecommendationSumAggregateInputType = {
    id?: true;
    userId?: true;
    recommendedFlowTemp?: true;
    expectedHeatTimeMin?: true;
    confidenceScore?: true;
};
export type RecommendationMinAggregateInputType = {
    id?: true;
    userId?: true;
    date?: true;
    recommendedFlowTemp?: true;
    expectedHeatTimeMin?: true;
    confidenceScore?: true;
    createdAt?: true;
};
export type RecommendationMaxAggregateInputType = {
    id?: true;
    userId?: true;
    date?: true;
    recommendedFlowTemp?: true;
    expectedHeatTimeMin?: true;
    confidenceScore?: true;
    createdAt?: true;
};
export type RecommendationCountAggregateInputType = {
    id?: true;
    userId?: true;
    date?: true;
    recommendedFlowTemp?: true;
    expectedHeatTimeMin?: true;
    confidenceScore?: true;
    createdAt?: true;
    _all?: true;
};
export type RecommendationAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.RecommendationWhereInput;
    orderBy?: Prisma.RecommendationOrderByWithRelationInput | Prisma.RecommendationOrderByWithRelationInput[];
    cursor?: Prisma.RecommendationWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | RecommendationCountAggregateInputType;
    _avg?: RecommendationAvgAggregateInputType;
    _sum?: RecommendationSumAggregateInputType;
    _min?: RecommendationMinAggregateInputType;
    _max?: RecommendationMaxAggregateInputType;
};
export type GetRecommendationAggregateType<T extends RecommendationAggregateArgs> = {
    [P in keyof T & keyof AggregateRecommendation]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateRecommendation[P]> : Prisma.GetScalarType<T[P], AggregateRecommendation[P]>;
};
export type RecommendationGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.RecommendationWhereInput;
    orderBy?: Prisma.RecommendationOrderByWithAggregationInput | Prisma.RecommendationOrderByWithAggregationInput[];
    by: Prisma.RecommendationScalarFieldEnum[] | Prisma.RecommendationScalarFieldEnum;
    having?: Prisma.RecommendationScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: RecommendationCountAggregateInputType | true;
    _avg?: RecommendationAvgAggregateInputType;
    _sum?: RecommendationSumAggregateInputType;
    _min?: RecommendationMinAggregateInputType;
    _max?: RecommendationMaxAggregateInputType;
};
export type RecommendationGroupByOutputType = {
    id: number;
    userId: number;
    date: Date;
    recommendedFlowTemp: number;
    expectedHeatTimeMin: number;
    confidenceScore: number;
    createdAt: Date;
    _count: RecommendationCountAggregateOutputType | null;
    _avg: RecommendationAvgAggregateOutputType | null;
    _sum: RecommendationSumAggregateOutputType | null;
    _min: RecommendationMinAggregateOutputType | null;
    _max: RecommendationMaxAggregateOutputType | null;
};
type GetRecommendationGroupByPayload<T extends RecommendationGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<RecommendationGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof RecommendationGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], RecommendationGroupByOutputType[P]> : Prisma.GetScalarType<T[P], RecommendationGroupByOutputType[P]>;
}>>;
export type RecommendationWhereInput = {
    AND?: Prisma.RecommendationWhereInput | Prisma.RecommendationWhereInput[];
    OR?: Prisma.RecommendationWhereInput[];
    NOT?: Prisma.RecommendationWhereInput | Prisma.RecommendationWhereInput[];
    id?: Prisma.IntFilter<"Recommendation"> | number;
    userId?: Prisma.IntFilter<"Recommendation"> | number;
    date?: Prisma.DateTimeFilter<"Recommendation"> | Date | string;
    recommendedFlowTemp?: Prisma.FloatFilter<"Recommendation"> | number;
    expectedHeatTimeMin?: Prisma.FloatFilter<"Recommendation"> | number;
    confidenceScore?: Prisma.FloatFilter<"Recommendation"> | number;
    createdAt?: Prisma.DateTimeFilter<"Recommendation"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
};
export type RecommendationOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    date?: Prisma.SortOrder;
    recommendedFlowTemp?: Prisma.SortOrder;
    expectedHeatTimeMin?: Prisma.SortOrder;
    confidenceScore?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    user?: Prisma.UserOrderByWithRelationInput;
};
export type RecommendationWhereUniqueInput = Prisma.AtLeast<{
    id?: number;
    AND?: Prisma.RecommendationWhereInput | Prisma.RecommendationWhereInput[];
    OR?: Prisma.RecommendationWhereInput[];
    NOT?: Prisma.RecommendationWhereInput | Prisma.RecommendationWhereInput[];
    userId?: Prisma.IntFilter<"Recommendation"> | number;
    date?: Prisma.DateTimeFilter<"Recommendation"> | Date | string;
    recommendedFlowTemp?: Prisma.FloatFilter<"Recommendation"> | number;
    expectedHeatTimeMin?: Prisma.FloatFilter<"Recommendation"> | number;
    confidenceScore?: Prisma.FloatFilter<"Recommendation"> | number;
    createdAt?: Prisma.DateTimeFilter<"Recommendation"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
}, "id">;
export type RecommendationOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    date?: Prisma.SortOrder;
    recommendedFlowTemp?: Prisma.SortOrder;
    expectedHeatTimeMin?: Prisma.SortOrder;
    confidenceScore?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    _count?: Prisma.RecommendationCountOrderByAggregateInput;
    _avg?: Prisma.RecommendationAvgOrderByAggregateInput;
    _max?: Prisma.RecommendationMaxOrderByAggregateInput;
    _min?: Prisma.RecommendationMinOrderByAggregateInput;
    _sum?: Prisma.RecommendationSumOrderByAggregateInput;
};
export type RecommendationScalarWhereWithAggregatesInput = {
    AND?: Prisma.RecommendationScalarWhereWithAggregatesInput | Prisma.RecommendationScalarWhereWithAggregatesInput[];
    OR?: Prisma.RecommendationScalarWhereWithAggregatesInput[];
    NOT?: Prisma.RecommendationScalarWhereWithAggregatesInput | Prisma.RecommendationScalarWhereWithAggregatesInput[];
    id?: Prisma.IntWithAggregatesFilter<"Recommendation"> | number;
    userId?: Prisma.IntWithAggregatesFilter<"Recommendation"> | number;
    date?: Prisma.DateTimeWithAggregatesFilter<"Recommendation"> | Date | string;
    recommendedFlowTemp?: Prisma.FloatWithAggregatesFilter<"Recommendation"> | number;
    expectedHeatTimeMin?: Prisma.FloatWithAggregatesFilter<"Recommendation"> | number;
    confidenceScore?: Prisma.FloatWithAggregatesFilter<"Recommendation"> | number;
    createdAt?: Prisma.DateTimeWithAggregatesFilter<"Recommendation"> | Date | string;
};
export type RecommendationCreateInput = {
    date: Date | string;
    recommendedFlowTemp: number;
    expectedHeatTimeMin: number;
    confidenceScore: number;
    createdAt?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutRecommendationsInput;
};
export type RecommendationUncheckedCreateInput = {
    id?: number;
    userId: number;
    date: Date | string;
    recommendedFlowTemp: number;
    expectedHeatTimeMin: number;
    confidenceScore: number;
    createdAt?: Date | string;
};
export type RecommendationUpdateInput = {
    date?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    recommendedFlowTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    expectedHeatTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidenceScore?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutRecommendationsNestedInput;
};
export type RecommendationUncheckedUpdateInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    date?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    recommendedFlowTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    expectedHeatTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidenceScore?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type RecommendationCreateManyInput = {
    id?: number;
    userId: number;
    date: Date | string;
    recommendedFlowTemp: number;
    expectedHeatTimeMin: number;
    confidenceScore: number;
    createdAt?: Date | string;
};
export type RecommendationUpdateManyMutationInput = {
    date?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    recommendedFlowTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    expectedHeatTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidenceScore?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type RecommendationUncheckedUpdateManyInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    date?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    recommendedFlowTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    expectedHeatTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidenceScore?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type RecommendationListRelationFilter = {
    every?: Prisma.RecommendationWhereInput;
    some?: Prisma.RecommendationWhereInput;
    none?: Prisma.RecommendationWhereInput;
};
export type RecommendationOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type RecommendationCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    date?: Prisma.SortOrder;
    recommendedFlowTemp?: Prisma.SortOrder;
    expectedHeatTimeMin?: Prisma.SortOrder;
    confidenceScore?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type RecommendationAvgOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    recommendedFlowTemp?: Prisma.SortOrder;
    expectedHeatTimeMin?: Prisma.SortOrder;
    confidenceScore?: Prisma.SortOrder;
};
export type RecommendationMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    date?: Prisma.SortOrder;
    recommendedFlowTemp?: Prisma.SortOrder;
    expectedHeatTimeMin?: Prisma.SortOrder;
    confidenceScore?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type RecommendationMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    date?: Prisma.SortOrder;
    recommendedFlowTemp?: Prisma.SortOrder;
    expectedHeatTimeMin?: Prisma.SortOrder;
    confidenceScore?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type RecommendationSumOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    recommendedFlowTemp?: Prisma.SortOrder;
    expectedHeatTimeMin?: Prisma.SortOrder;
    confidenceScore?: Prisma.SortOrder;
};
export type RecommendationCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.RecommendationCreateWithoutUserInput, Prisma.RecommendationUncheckedCreateWithoutUserInput> | Prisma.RecommendationCreateWithoutUserInput[] | Prisma.RecommendationUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.RecommendationCreateOrConnectWithoutUserInput | Prisma.RecommendationCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.RecommendationCreateManyUserInputEnvelope;
    connect?: Prisma.RecommendationWhereUniqueInput | Prisma.RecommendationWhereUniqueInput[];
};
export type RecommendationUncheckedCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.RecommendationCreateWithoutUserInput, Prisma.RecommendationUncheckedCreateWithoutUserInput> | Prisma.RecommendationCreateWithoutUserInput[] | Prisma.RecommendationUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.RecommendationCreateOrConnectWithoutUserInput | Prisma.RecommendationCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.RecommendationCreateManyUserInputEnvelope;
    connect?: Prisma.RecommendationWhereUniqueInput | Prisma.RecommendationWhereUniqueInput[];
};
export type RecommendationUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.RecommendationCreateWithoutUserInput, Prisma.RecommendationUncheckedCreateWithoutUserInput> | Prisma.RecommendationCreateWithoutUserInput[] | Prisma.RecommendationUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.RecommendationCreateOrConnectWithoutUserInput | Prisma.RecommendationCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.RecommendationUpsertWithWhereUniqueWithoutUserInput | Prisma.RecommendationUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.RecommendationCreateManyUserInputEnvelope;
    set?: Prisma.RecommendationWhereUniqueInput | Prisma.RecommendationWhereUniqueInput[];
    disconnect?: Prisma.RecommendationWhereUniqueInput | Prisma.RecommendationWhereUniqueInput[];
    delete?: Prisma.RecommendationWhereUniqueInput | Prisma.RecommendationWhereUniqueInput[];
    connect?: Prisma.RecommendationWhereUniqueInput | Prisma.RecommendationWhereUniqueInput[];
    update?: Prisma.RecommendationUpdateWithWhereUniqueWithoutUserInput | Prisma.RecommendationUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.RecommendationUpdateManyWithWhereWithoutUserInput | Prisma.RecommendationUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.RecommendationScalarWhereInput | Prisma.RecommendationScalarWhereInput[];
};
export type RecommendationUncheckedUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.RecommendationCreateWithoutUserInput, Prisma.RecommendationUncheckedCreateWithoutUserInput> | Prisma.RecommendationCreateWithoutUserInput[] | Prisma.RecommendationUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.RecommendationCreateOrConnectWithoutUserInput | Prisma.RecommendationCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.RecommendationUpsertWithWhereUniqueWithoutUserInput | Prisma.RecommendationUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.RecommendationCreateManyUserInputEnvelope;
    set?: Prisma.RecommendationWhereUniqueInput | Prisma.RecommendationWhereUniqueInput[];
    disconnect?: Prisma.RecommendationWhereUniqueInput | Prisma.RecommendationWhereUniqueInput[];
    delete?: Prisma.RecommendationWhereUniqueInput | Prisma.RecommendationWhereUniqueInput[];
    connect?: Prisma.RecommendationWhereUniqueInput | Prisma.RecommendationWhereUniqueInput[];
    update?: Prisma.RecommendationUpdateWithWhereUniqueWithoutUserInput | Prisma.RecommendationUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.RecommendationUpdateManyWithWhereWithoutUserInput | Prisma.RecommendationUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.RecommendationScalarWhereInput | Prisma.RecommendationScalarWhereInput[];
};
export type RecommendationCreateWithoutUserInput = {
    date: Date | string;
    recommendedFlowTemp: number;
    expectedHeatTimeMin: number;
    confidenceScore: number;
    createdAt?: Date | string;
};
export type RecommendationUncheckedCreateWithoutUserInput = {
    id?: number;
    date: Date | string;
    recommendedFlowTemp: number;
    expectedHeatTimeMin: number;
    confidenceScore: number;
    createdAt?: Date | string;
};
export type RecommendationCreateOrConnectWithoutUserInput = {
    where: Prisma.RecommendationWhereUniqueInput;
    create: Prisma.XOR<Prisma.RecommendationCreateWithoutUserInput, Prisma.RecommendationUncheckedCreateWithoutUserInput>;
};
export type RecommendationCreateManyUserInputEnvelope = {
    data: Prisma.RecommendationCreateManyUserInput | Prisma.RecommendationCreateManyUserInput[];
    skipDuplicates?: boolean;
};
export type RecommendationUpsertWithWhereUniqueWithoutUserInput = {
    where: Prisma.RecommendationWhereUniqueInput;
    update: Prisma.XOR<Prisma.RecommendationUpdateWithoutUserInput, Prisma.RecommendationUncheckedUpdateWithoutUserInput>;
    create: Prisma.XOR<Prisma.RecommendationCreateWithoutUserInput, Prisma.RecommendationUncheckedCreateWithoutUserInput>;
};
export type RecommendationUpdateWithWhereUniqueWithoutUserInput = {
    where: Prisma.RecommendationWhereUniqueInput;
    data: Prisma.XOR<Prisma.RecommendationUpdateWithoutUserInput, Prisma.RecommendationUncheckedUpdateWithoutUserInput>;
};
export type RecommendationUpdateManyWithWhereWithoutUserInput = {
    where: Prisma.RecommendationScalarWhereInput;
    data: Prisma.XOR<Prisma.RecommendationUpdateManyMutationInput, Prisma.RecommendationUncheckedUpdateManyWithoutUserInput>;
};
export type RecommendationScalarWhereInput = {
    AND?: Prisma.RecommendationScalarWhereInput | Prisma.RecommendationScalarWhereInput[];
    OR?: Prisma.RecommendationScalarWhereInput[];
    NOT?: Prisma.RecommendationScalarWhereInput | Prisma.RecommendationScalarWhereInput[];
    id?: Prisma.IntFilter<"Recommendation"> | number;
    userId?: Prisma.IntFilter<"Recommendation"> | number;
    date?: Prisma.DateTimeFilter<"Recommendation"> | Date | string;
    recommendedFlowTemp?: Prisma.FloatFilter<"Recommendation"> | number;
    expectedHeatTimeMin?: Prisma.FloatFilter<"Recommendation"> | number;
    confidenceScore?: Prisma.FloatFilter<"Recommendation"> | number;
    createdAt?: Prisma.DateTimeFilter<"Recommendation"> | Date | string;
};
export type RecommendationCreateManyUserInput = {
    id?: number;
    date: Date | string;
    recommendedFlowTemp: number;
    expectedHeatTimeMin: number;
    confidenceScore: number;
    createdAt?: Date | string;
};
export type RecommendationUpdateWithoutUserInput = {
    date?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    recommendedFlowTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    expectedHeatTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidenceScore?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type RecommendationUncheckedUpdateWithoutUserInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    date?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    recommendedFlowTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    expectedHeatTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidenceScore?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type RecommendationUncheckedUpdateManyWithoutUserInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    date?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    recommendedFlowTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    expectedHeatTimeMin?: Prisma.FloatFieldUpdateOperationsInput | number;
    confidenceScore?: Prisma.FloatFieldUpdateOperationsInput | number;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type RecommendationSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    userId?: boolean;
    date?: boolean;
    recommendedFlowTemp?: boolean;
    expectedHeatTimeMin?: boolean;
    confidenceScore?: boolean;
    createdAt?: boolean;
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["recommendation"]>;
export type RecommendationSelectScalar = {
    id?: boolean;
    userId?: boolean;
    date?: boolean;
    recommendedFlowTemp?: boolean;
    expectedHeatTimeMin?: boolean;
    confidenceScore?: boolean;
    createdAt?: boolean;
};
export type RecommendationOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "userId" | "date" | "recommendedFlowTemp" | "expectedHeatTimeMin" | "confidenceScore" | "createdAt", ExtArgs["result"]["recommendation"]>;
export type RecommendationInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
};
export type $RecommendationPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "Recommendation";
    objects: {
        user: Prisma.$UserPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: number;
        userId: number;
        date: Date;
        recommendedFlowTemp: number;
        expectedHeatTimeMin: number;
        confidenceScore: number;
        createdAt: Date;
    }, ExtArgs["result"]["recommendation"]>;
    composites: {};
};
export type RecommendationGetPayload<S extends boolean | null | undefined | RecommendationDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$RecommendationPayload, S>;
export type RecommendationCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<RecommendationFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: RecommendationCountAggregateInputType | true;
};
export interface RecommendationDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['Recommendation'];
        meta: {
            name: 'Recommendation';
        };
    };
    findUnique<T extends RecommendationFindUniqueArgs>(args: Prisma.SelectSubset<T, RecommendationFindUniqueArgs<ExtArgs>>): Prisma.Prisma__RecommendationClient<runtime.Types.Result.GetResult<Prisma.$RecommendationPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends RecommendationFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, RecommendationFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__RecommendationClient<runtime.Types.Result.GetResult<Prisma.$RecommendationPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends RecommendationFindFirstArgs>(args?: Prisma.SelectSubset<T, RecommendationFindFirstArgs<ExtArgs>>): Prisma.Prisma__RecommendationClient<runtime.Types.Result.GetResult<Prisma.$RecommendationPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends RecommendationFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, RecommendationFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__RecommendationClient<runtime.Types.Result.GetResult<Prisma.$RecommendationPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends RecommendationFindManyArgs>(args?: Prisma.SelectSubset<T, RecommendationFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$RecommendationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends RecommendationCreateArgs>(args: Prisma.SelectSubset<T, RecommendationCreateArgs<ExtArgs>>): Prisma.Prisma__RecommendationClient<runtime.Types.Result.GetResult<Prisma.$RecommendationPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends RecommendationCreateManyArgs>(args?: Prisma.SelectSubset<T, RecommendationCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends RecommendationDeleteArgs>(args: Prisma.SelectSubset<T, RecommendationDeleteArgs<ExtArgs>>): Prisma.Prisma__RecommendationClient<runtime.Types.Result.GetResult<Prisma.$RecommendationPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends RecommendationUpdateArgs>(args: Prisma.SelectSubset<T, RecommendationUpdateArgs<ExtArgs>>): Prisma.Prisma__RecommendationClient<runtime.Types.Result.GetResult<Prisma.$RecommendationPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends RecommendationDeleteManyArgs>(args?: Prisma.SelectSubset<T, RecommendationDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends RecommendationUpdateManyArgs>(args: Prisma.SelectSubset<T, RecommendationUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends RecommendationUpsertArgs>(args: Prisma.SelectSubset<T, RecommendationUpsertArgs<ExtArgs>>): Prisma.Prisma__RecommendationClient<runtime.Types.Result.GetResult<Prisma.$RecommendationPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends RecommendationCountArgs>(args?: Prisma.Subset<T, RecommendationCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], RecommendationCountAggregateOutputType> : number>;
    aggregate<T extends RecommendationAggregateArgs>(args: Prisma.Subset<T, RecommendationAggregateArgs>): Prisma.PrismaPromise<GetRecommendationAggregateType<T>>;
    groupBy<T extends RecommendationGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: RecommendationGroupByArgs['orderBy'];
    } : {
        orderBy?: RecommendationGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, RecommendationGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetRecommendationGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: RecommendationFieldRefs;
}
export interface Prisma__RecommendationClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    user<T extends Prisma.UserDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.UserDefaultArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface RecommendationFieldRefs {
    readonly id: Prisma.FieldRef<"Recommendation", 'Int'>;
    readonly userId: Prisma.FieldRef<"Recommendation", 'Int'>;
    readonly date: Prisma.FieldRef<"Recommendation", 'DateTime'>;
    readonly recommendedFlowTemp: Prisma.FieldRef<"Recommendation", 'Float'>;
    readonly expectedHeatTimeMin: Prisma.FieldRef<"Recommendation", 'Float'>;
    readonly confidenceScore: Prisma.FieldRef<"Recommendation", 'Float'>;
    readonly createdAt: Prisma.FieldRef<"Recommendation", 'DateTime'>;
}
export type RecommendationFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.RecommendationSelect<ExtArgs> | null;
    omit?: Prisma.RecommendationOmit<ExtArgs> | null;
    include?: Prisma.RecommendationInclude<ExtArgs> | null;
    where: Prisma.RecommendationWhereUniqueInput;
};
export type RecommendationFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.RecommendationSelect<ExtArgs> | null;
    omit?: Prisma.RecommendationOmit<ExtArgs> | null;
    include?: Prisma.RecommendationInclude<ExtArgs> | null;
    where: Prisma.RecommendationWhereUniqueInput;
};
export type RecommendationFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.RecommendationSelect<ExtArgs> | null;
    omit?: Prisma.RecommendationOmit<ExtArgs> | null;
    include?: Prisma.RecommendationInclude<ExtArgs> | null;
    where?: Prisma.RecommendationWhereInput;
    orderBy?: Prisma.RecommendationOrderByWithRelationInput | Prisma.RecommendationOrderByWithRelationInput[];
    cursor?: Prisma.RecommendationWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.RecommendationScalarFieldEnum | Prisma.RecommendationScalarFieldEnum[];
};
export type RecommendationFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.RecommendationSelect<ExtArgs> | null;
    omit?: Prisma.RecommendationOmit<ExtArgs> | null;
    include?: Prisma.RecommendationInclude<ExtArgs> | null;
    where?: Prisma.RecommendationWhereInput;
    orderBy?: Prisma.RecommendationOrderByWithRelationInput | Prisma.RecommendationOrderByWithRelationInput[];
    cursor?: Prisma.RecommendationWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.RecommendationScalarFieldEnum | Prisma.RecommendationScalarFieldEnum[];
};
export type RecommendationFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.RecommendationSelect<ExtArgs> | null;
    omit?: Prisma.RecommendationOmit<ExtArgs> | null;
    include?: Prisma.RecommendationInclude<ExtArgs> | null;
    where?: Prisma.RecommendationWhereInput;
    orderBy?: Prisma.RecommendationOrderByWithRelationInput | Prisma.RecommendationOrderByWithRelationInput[];
    cursor?: Prisma.RecommendationWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.RecommendationScalarFieldEnum | Prisma.RecommendationScalarFieldEnum[];
};
export type RecommendationCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.RecommendationSelect<ExtArgs> | null;
    omit?: Prisma.RecommendationOmit<ExtArgs> | null;
    include?: Prisma.RecommendationInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.RecommendationCreateInput, Prisma.RecommendationUncheckedCreateInput>;
};
export type RecommendationCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.RecommendationCreateManyInput | Prisma.RecommendationCreateManyInput[];
    skipDuplicates?: boolean;
};
export type RecommendationUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.RecommendationSelect<ExtArgs> | null;
    omit?: Prisma.RecommendationOmit<ExtArgs> | null;
    include?: Prisma.RecommendationInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.RecommendationUpdateInput, Prisma.RecommendationUncheckedUpdateInput>;
    where: Prisma.RecommendationWhereUniqueInput;
};
export type RecommendationUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.RecommendationUpdateManyMutationInput, Prisma.RecommendationUncheckedUpdateManyInput>;
    where?: Prisma.RecommendationWhereInput;
    limit?: number;
};
export type RecommendationUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.RecommendationSelect<ExtArgs> | null;
    omit?: Prisma.RecommendationOmit<ExtArgs> | null;
    include?: Prisma.RecommendationInclude<ExtArgs> | null;
    where: Prisma.RecommendationWhereUniqueInput;
    create: Prisma.XOR<Prisma.RecommendationCreateInput, Prisma.RecommendationUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.RecommendationUpdateInput, Prisma.RecommendationUncheckedUpdateInput>;
};
export type RecommendationDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.RecommendationSelect<ExtArgs> | null;
    omit?: Prisma.RecommendationOmit<ExtArgs> | null;
    include?: Prisma.RecommendationInclude<ExtArgs> | null;
    where: Prisma.RecommendationWhereUniqueInput;
};
export type RecommendationDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.RecommendationWhereInput;
    limit?: number;
};
export type RecommendationDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.RecommendationSelect<ExtArgs> | null;
    omit?: Prisma.RecommendationOmit<ExtArgs> | null;
    include?: Prisma.RecommendationInclude<ExtArgs> | null;
};
export {};
