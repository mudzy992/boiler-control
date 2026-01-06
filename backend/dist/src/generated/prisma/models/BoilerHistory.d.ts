import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type BoilerHistoryModel = runtime.Types.Result.DefaultSelection<Prisma.$BoilerHistoryPayload>;
export type AggregateBoilerHistory = {
    _count: BoilerHistoryCountAggregateOutputType | null;
    _avg: BoilerHistoryAvgAggregateOutputType | null;
    _sum: BoilerHistorySumAggregateOutputType | null;
    _min: BoilerHistoryMinAggregateOutputType | null;
    _max: BoilerHistoryMaxAggregateOutputType | null;
};
export type BoilerHistoryAvgAggregateOutputType = {
    id: number | null;
    userId: number | null;
    externalTemp: number | null;
    suggestedTemp: number | null;
    actualTemp: number | null;
};
export type BoilerHistorySumAggregateOutputType = {
    id: number | null;
    userId: number | null;
    externalTemp: number | null;
    suggestedTemp: number | null;
    actualTemp: number | null;
};
export type BoilerHistoryMinAggregateOutputType = {
    id: number | null;
    userId: number | null;
    externalTemp: number | null;
    suggestedTemp: number | null;
    actualTemp: number | null;
    heatingStart: Date | null;
    heatingEnd: Date | null;
    createdAt: Date | null;
};
export type BoilerHistoryMaxAggregateOutputType = {
    id: number | null;
    userId: number | null;
    externalTemp: number | null;
    suggestedTemp: number | null;
    actualTemp: number | null;
    heatingStart: Date | null;
    heatingEnd: Date | null;
    createdAt: Date | null;
};
export type BoilerHistoryCountAggregateOutputType = {
    id: number;
    userId: number;
    externalTemp: number;
    suggestedTemp: number;
    actualTemp: number;
    heatingStart: number;
    heatingEnd: number;
    createdAt: number;
    _all: number;
};
export type BoilerHistoryAvgAggregateInputType = {
    id?: true;
    userId?: true;
    externalTemp?: true;
    suggestedTemp?: true;
    actualTemp?: true;
};
export type BoilerHistorySumAggregateInputType = {
    id?: true;
    userId?: true;
    externalTemp?: true;
    suggestedTemp?: true;
    actualTemp?: true;
};
export type BoilerHistoryMinAggregateInputType = {
    id?: true;
    userId?: true;
    externalTemp?: true;
    suggestedTemp?: true;
    actualTemp?: true;
    heatingStart?: true;
    heatingEnd?: true;
    createdAt?: true;
};
export type BoilerHistoryMaxAggregateInputType = {
    id?: true;
    userId?: true;
    externalTemp?: true;
    suggestedTemp?: true;
    actualTemp?: true;
    heatingStart?: true;
    heatingEnd?: true;
    createdAt?: true;
};
export type BoilerHistoryCountAggregateInputType = {
    id?: true;
    userId?: true;
    externalTemp?: true;
    suggestedTemp?: true;
    actualTemp?: true;
    heatingStart?: true;
    heatingEnd?: true;
    createdAt?: true;
    _all?: true;
};
export type BoilerHistoryAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.BoilerHistoryWhereInput;
    orderBy?: Prisma.BoilerHistoryOrderByWithRelationInput | Prisma.BoilerHistoryOrderByWithRelationInput[];
    cursor?: Prisma.BoilerHistoryWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | BoilerHistoryCountAggregateInputType;
    _avg?: BoilerHistoryAvgAggregateInputType;
    _sum?: BoilerHistorySumAggregateInputType;
    _min?: BoilerHistoryMinAggregateInputType;
    _max?: BoilerHistoryMaxAggregateInputType;
};
export type GetBoilerHistoryAggregateType<T extends BoilerHistoryAggregateArgs> = {
    [P in keyof T & keyof AggregateBoilerHistory]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateBoilerHistory[P]> : Prisma.GetScalarType<T[P], AggregateBoilerHistory[P]>;
};
export type BoilerHistoryGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.BoilerHistoryWhereInput;
    orderBy?: Prisma.BoilerHistoryOrderByWithAggregationInput | Prisma.BoilerHistoryOrderByWithAggregationInput[];
    by: Prisma.BoilerHistoryScalarFieldEnum[] | Prisma.BoilerHistoryScalarFieldEnum;
    having?: Prisma.BoilerHistoryScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: BoilerHistoryCountAggregateInputType | true;
    _avg?: BoilerHistoryAvgAggregateInputType;
    _sum?: BoilerHistorySumAggregateInputType;
    _min?: BoilerHistoryMinAggregateInputType;
    _max?: BoilerHistoryMaxAggregateInputType;
};
export type BoilerHistoryGroupByOutputType = {
    id: number;
    userId: number;
    externalTemp: number;
    suggestedTemp: number;
    actualTemp: number | null;
    heatingStart: Date | null;
    heatingEnd: Date | null;
    createdAt: Date;
    _count: BoilerHistoryCountAggregateOutputType | null;
    _avg: BoilerHistoryAvgAggregateOutputType | null;
    _sum: BoilerHistorySumAggregateOutputType | null;
    _min: BoilerHistoryMinAggregateOutputType | null;
    _max: BoilerHistoryMaxAggregateOutputType | null;
};
type GetBoilerHistoryGroupByPayload<T extends BoilerHistoryGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<BoilerHistoryGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof BoilerHistoryGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], BoilerHistoryGroupByOutputType[P]> : Prisma.GetScalarType<T[P], BoilerHistoryGroupByOutputType[P]>;
}>>;
export type BoilerHistoryWhereInput = {
    AND?: Prisma.BoilerHistoryWhereInput | Prisma.BoilerHistoryWhereInput[];
    OR?: Prisma.BoilerHistoryWhereInput[];
    NOT?: Prisma.BoilerHistoryWhereInput | Prisma.BoilerHistoryWhereInput[];
    id?: Prisma.IntFilter<"BoilerHistory"> | number;
    userId?: Prisma.IntFilter<"BoilerHistory"> | number;
    externalTemp?: Prisma.FloatFilter<"BoilerHistory"> | number;
    suggestedTemp?: Prisma.FloatFilter<"BoilerHistory"> | number;
    actualTemp?: Prisma.FloatNullableFilter<"BoilerHistory"> | number | null;
    heatingStart?: Prisma.DateTimeNullableFilter<"BoilerHistory"> | Date | string | null;
    heatingEnd?: Prisma.DateTimeNullableFilter<"BoilerHistory"> | Date | string | null;
    createdAt?: Prisma.DateTimeFilter<"BoilerHistory"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
};
export type BoilerHistoryOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    externalTemp?: Prisma.SortOrder;
    suggestedTemp?: Prisma.SortOrder;
    actualTemp?: Prisma.SortOrderInput | Prisma.SortOrder;
    heatingStart?: Prisma.SortOrderInput | Prisma.SortOrder;
    heatingEnd?: Prisma.SortOrderInput | Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    user?: Prisma.UserOrderByWithRelationInput;
};
export type BoilerHistoryWhereUniqueInput = Prisma.AtLeast<{
    id?: number;
    AND?: Prisma.BoilerHistoryWhereInput | Prisma.BoilerHistoryWhereInput[];
    OR?: Prisma.BoilerHistoryWhereInput[];
    NOT?: Prisma.BoilerHistoryWhereInput | Prisma.BoilerHistoryWhereInput[];
    userId?: Prisma.IntFilter<"BoilerHistory"> | number;
    externalTemp?: Prisma.FloatFilter<"BoilerHistory"> | number;
    suggestedTemp?: Prisma.FloatFilter<"BoilerHistory"> | number;
    actualTemp?: Prisma.FloatNullableFilter<"BoilerHistory"> | number | null;
    heatingStart?: Prisma.DateTimeNullableFilter<"BoilerHistory"> | Date | string | null;
    heatingEnd?: Prisma.DateTimeNullableFilter<"BoilerHistory"> | Date | string | null;
    createdAt?: Prisma.DateTimeFilter<"BoilerHistory"> | Date | string;
    user?: Prisma.XOR<Prisma.UserScalarRelationFilter, Prisma.UserWhereInput>;
}, "id">;
export type BoilerHistoryOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    externalTemp?: Prisma.SortOrder;
    suggestedTemp?: Prisma.SortOrder;
    actualTemp?: Prisma.SortOrderInput | Prisma.SortOrder;
    heatingStart?: Prisma.SortOrderInput | Prisma.SortOrder;
    heatingEnd?: Prisma.SortOrderInput | Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    _count?: Prisma.BoilerHistoryCountOrderByAggregateInput;
    _avg?: Prisma.BoilerHistoryAvgOrderByAggregateInput;
    _max?: Prisma.BoilerHistoryMaxOrderByAggregateInput;
    _min?: Prisma.BoilerHistoryMinOrderByAggregateInput;
    _sum?: Prisma.BoilerHistorySumOrderByAggregateInput;
};
export type BoilerHistoryScalarWhereWithAggregatesInput = {
    AND?: Prisma.BoilerHistoryScalarWhereWithAggregatesInput | Prisma.BoilerHistoryScalarWhereWithAggregatesInput[];
    OR?: Prisma.BoilerHistoryScalarWhereWithAggregatesInput[];
    NOT?: Prisma.BoilerHistoryScalarWhereWithAggregatesInput | Prisma.BoilerHistoryScalarWhereWithAggregatesInput[];
    id?: Prisma.IntWithAggregatesFilter<"BoilerHistory"> | number;
    userId?: Prisma.IntWithAggregatesFilter<"BoilerHistory"> | number;
    externalTemp?: Prisma.FloatWithAggregatesFilter<"BoilerHistory"> | number;
    suggestedTemp?: Prisma.FloatWithAggregatesFilter<"BoilerHistory"> | number;
    actualTemp?: Prisma.FloatNullableWithAggregatesFilter<"BoilerHistory"> | number | null;
    heatingStart?: Prisma.DateTimeNullableWithAggregatesFilter<"BoilerHistory"> | Date | string | null;
    heatingEnd?: Prisma.DateTimeNullableWithAggregatesFilter<"BoilerHistory"> | Date | string | null;
    createdAt?: Prisma.DateTimeWithAggregatesFilter<"BoilerHistory"> | Date | string;
};
export type BoilerHistoryCreateInput = {
    externalTemp: number;
    suggestedTemp: number;
    actualTemp?: number | null;
    heatingStart?: Date | string | null;
    heatingEnd?: Date | string | null;
    createdAt?: Date | string;
    user: Prisma.UserCreateNestedOneWithoutBoilerHistoriesInput;
};
export type BoilerHistoryUncheckedCreateInput = {
    id?: number;
    userId: number;
    externalTemp: number;
    suggestedTemp: number;
    actualTemp?: number | null;
    heatingStart?: Date | string | null;
    heatingEnd?: Date | string | null;
    createdAt?: Date | string;
};
export type BoilerHistoryUpdateInput = {
    externalTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    suggestedTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    actualTemp?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    heatingStart?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    heatingEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    user?: Prisma.UserUpdateOneRequiredWithoutBoilerHistoriesNestedInput;
};
export type BoilerHistoryUncheckedUpdateInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    externalTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    suggestedTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    actualTemp?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    heatingStart?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    heatingEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type BoilerHistoryCreateManyInput = {
    id?: number;
    userId: number;
    externalTemp: number;
    suggestedTemp: number;
    actualTemp?: number | null;
    heatingStart?: Date | string | null;
    heatingEnd?: Date | string | null;
    createdAt?: Date | string;
};
export type BoilerHistoryUpdateManyMutationInput = {
    externalTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    suggestedTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    actualTemp?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    heatingStart?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    heatingEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type BoilerHistoryUncheckedUpdateManyInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    userId?: Prisma.IntFieldUpdateOperationsInput | number;
    externalTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    suggestedTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    actualTemp?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    heatingStart?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    heatingEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type BoilerHistoryListRelationFilter = {
    every?: Prisma.BoilerHistoryWhereInput;
    some?: Prisma.BoilerHistoryWhereInput;
    none?: Prisma.BoilerHistoryWhereInput;
};
export type BoilerHistoryOrderByRelationAggregateInput = {
    _count?: Prisma.SortOrder;
};
export type BoilerHistoryCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    externalTemp?: Prisma.SortOrder;
    suggestedTemp?: Prisma.SortOrder;
    actualTemp?: Prisma.SortOrder;
    heatingStart?: Prisma.SortOrder;
    heatingEnd?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type BoilerHistoryAvgOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    externalTemp?: Prisma.SortOrder;
    suggestedTemp?: Prisma.SortOrder;
    actualTemp?: Prisma.SortOrder;
};
export type BoilerHistoryMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    externalTemp?: Prisma.SortOrder;
    suggestedTemp?: Prisma.SortOrder;
    actualTemp?: Prisma.SortOrder;
    heatingStart?: Prisma.SortOrder;
    heatingEnd?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type BoilerHistoryMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    externalTemp?: Prisma.SortOrder;
    suggestedTemp?: Prisma.SortOrder;
    actualTemp?: Prisma.SortOrder;
    heatingStart?: Prisma.SortOrder;
    heatingEnd?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
};
export type BoilerHistorySumOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    userId?: Prisma.SortOrder;
    externalTemp?: Prisma.SortOrder;
    suggestedTemp?: Prisma.SortOrder;
    actualTemp?: Prisma.SortOrder;
};
export type BoilerHistoryCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.BoilerHistoryCreateWithoutUserInput, Prisma.BoilerHistoryUncheckedCreateWithoutUserInput> | Prisma.BoilerHistoryCreateWithoutUserInput[] | Prisma.BoilerHistoryUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.BoilerHistoryCreateOrConnectWithoutUserInput | Prisma.BoilerHistoryCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.BoilerHistoryCreateManyUserInputEnvelope;
    connect?: Prisma.BoilerHistoryWhereUniqueInput | Prisma.BoilerHistoryWhereUniqueInput[];
};
export type BoilerHistoryUncheckedCreateNestedManyWithoutUserInput = {
    create?: Prisma.XOR<Prisma.BoilerHistoryCreateWithoutUserInput, Prisma.BoilerHistoryUncheckedCreateWithoutUserInput> | Prisma.BoilerHistoryCreateWithoutUserInput[] | Prisma.BoilerHistoryUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.BoilerHistoryCreateOrConnectWithoutUserInput | Prisma.BoilerHistoryCreateOrConnectWithoutUserInput[];
    createMany?: Prisma.BoilerHistoryCreateManyUserInputEnvelope;
    connect?: Prisma.BoilerHistoryWhereUniqueInput | Prisma.BoilerHistoryWhereUniqueInput[];
};
export type BoilerHistoryUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.BoilerHistoryCreateWithoutUserInput, Prisma.BoilerHistoryUncheckedCreateWithoutUserInput> | Prisma.BoilerHistoryCreateWithoutUserInput[] | Prisma.BoilerHistoryUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.BoilerHistoryCreateOrConnectWithoutUserInput | Prisma.BoilerHistoryCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.BoilerHistoryUpsertWithWhereUniqueWithoutUserInput | Prisma.BoilerHistoryUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.BoilerHistoryCreateManyUserInputEnvelope;
    set?: Prisma.BoilerHistoryWhereUniqueInput | Prisma.BoilerHistoryWhereUniqueInput[];
    disconnect?: Prisma.BoilerHistoryWhereUniqueInput | Prisma.BoilerHistoryWhereUniqueInput[];
    delete?: Prisma.BoilerHistoryWhereUniqueInput | Prisma.BoilerHistoryWhereUniqueInput[];
    connect?: Prisma.BoilerHistoryWhereUniqueInput | Prisma.BoilerHistoryWhereUniqueInput[];
    update?: Prisma.BoilerHistoryUpdateWithWhereUniqueWithoutUserInput | Prisma.BoilerHistoryUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.BoilerHistoryUpdateManyWithWhereWithoutUserInput | Prisma.BoilerHistoryUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.BoilerHistoryScalarWhereInput | Prisma.BoilerHistoryScalarWhereInput[];
};
export type BoilerHistoryUncheckedUpdateManyWithoutUserNestedInput = {
    create?: Prisma.XOR<Prisma.BoilerHistoryCreateWithoutUserInput, Prisma.BoilerHistoryUncheckedCreateWithoutUserInput> | Prisma.BoilerHistoryCreateWithoutUserInput[] | Prisma.BoilerHistoryUncheckedCreateWithoutUserInput[];
    connectOrCreate?: Prisma.BoilerHistoryCreateOrConnectWithoutUserInput | Prisma.BoilerHistoryCreateOrConnectWithoutUserInput[];
    upsert?: Prisma.BoilerHistoryUpsertWithWhereUniqueWithoutUserInput | Prisma.BoilerHistoryUpsertWithWhereUniqueWithoutUserInput[];
    createMany?: Prisma.BoilerHistoryCreateManyUserInputEnvelope;
    set?: Prisma.BoilerHistoryWhereUniqueInput | Prisma.BoilerHistoryWhereUniqueInput[];
    disconnect?: Prisma.BoilerHistoryWhereUniqueInput | Prisma.BoilerHistoryWhereUniqueInput[];
    delete?: Prisma.BoilerHistoryWhereUniqueInput | Prisma.BoilerHistoryWhereUniqueInput[];
    connect?: Prisma.BoilerHistoryWhereUniqueInput | Prisma.BoilerHistoryWhereUniqueInput[];
    update?: Prisma.BoilerHistoryUpdateWithWhereUniqueWithoutUserInput | Prisma.BoilerHistoryUpdateWithWhereUniqueWithoutUserInput[];
    updateMany?: Prisma.BoilerHistoryUpdateManyWithWhereWithoutUserInput | Prisma.BoilerHistoryUpdateManyWithWhereWithoutUserInput[];
    deleteMany?: Prisma.BoilerHistoryScalarWhereInput | Prisma.BoilerHistoryScalarWhereInput[];
};
export type BoilerHistoryCreateWithoutUserInput = {
    externalTemp: number;
    suggestedTemp: number;
    actualTemp?: number | null;
    heatingStart?: Date | string | null;
    heatingEnd?: Date | string | null;
    createdAt?: Date | string;
};
export type BoilerHistoryUncheckedCreateWithoutUserInput = {
    id?: number;
    externalTemp: number;
    suggestedTemp: number;
    actualTemp?: number | null;
    heatingStart?: Date | string | null;
    heatingEnd?: Date | string | null;
    createdAt?: Date | string;
};
export type BoilerHistoryCreateOrConnectWithoutUserInput = {
    where: Prisma.BoilerHistoryWhereUniqueInput;
    create: Prisma.XOR<Prisma.BoilerHistoryCreateWithoutUserInput, Prisma.BoilerHistoryUncheckedCreateWithoutUserInput>;
};
export type BoilerHistoryCreateManyUserInputEnvelope = {
    data: Prisma.BoilerHistoryCreateManyUserInput | Prisma.BoilerHistoryCreateManyUserInput[];
    skipDuplicates?: boolean;
};
export type BoilerHistoryUpsertWithWhereUniqueWithoutUserInput = {
    where: Prisma.BoilerHistoryWhereUniqueInput;
    update: Prisma.XOR<Prisma.BoilerHistoryUpdateWithoutUserInput, Prisma.BoilerHistoryUncheckedUpdateWithoutUserInput>;
    create: Prisma.XOR<Prisma.BoilerHistoryCreateWithoutUserInput, Prisma.BoilerHistoryUncheckedCreateWithoutUserInput>;
};
export type BoilerHistoryUpdateWithWhereUniqueWithoutUserInput = {
    where: Prisma.BoilerHistoryWhereUniqueInput;
    data: Prisma.XOR<Prisma.BoilerHistoryUpdateWithoutUserInput, Prisma.BoilerHistoryUncheckedUpdateWithoutUserInput>;
};
export type BoilerHistoryUpdateManyWithWhereWithoutUserInput = {
    where: Prisma.BoilerHistoryScalarWhereInput;
    data: Prisma.XOR<Prisma.BoilerHistoryUpdateManyMutationInput, Prisma.BoilerHistoryUncheckedUpdateManyWithoutUserInput>;
};
export type BoilerHistoryScalarWhereInput = {
    AND?: Prisma.BoilerHistoryScalarWhereInput | Prisma.BoilerHistoryScalarWhereInput[];
    OR?: Prisma.BoilerHistoryScalarWhereInput[];
    NOT?: Prisma.BoilerHistoryScalarWhereInput | Prisma.BoilerHistoryScalarWhereInput[];
    id?: Prisma.IntFilter<"BoilerHistory"> | number;
    userId?: Prisma.IntFilter<"BoilerHistory"> | number;
    externalTemp?: Prisma.FloatFilter<"BoilerHistory"> | number;
    suggestedTemp?: Prisma.FloatFilter<"BoilerHistory"> | number;
    actualTemp?: Prisma.FloatNullableFilter<"BoilerHistory"> | number | null;
    heatingStart?: Prisma.DateTimeNullableFilter<"BoilerHistory"> | Date | string | null;
    heatingEnd?: Prisma.DateTimeNullableFilter<"BoilerHistory"> | Date | string | null;
    createdAt?: Prisma.DateTimeFilter<"BoilerHistory"> | Date | string;
};
export type BoilerHistoryCreateManyUserInput = {
    id?: number;
    externalTemp: number;
    suggestedTemp: number;
    actualTemp?: number | null;
    heatingStart?: Date | string | null;
    heatingEnd?: Date | string | null;
    createdAt?: Date | string;
};
export type BoilerHistoryUpdateWithoutUserInput = {
    externalTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    suggestedTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    actualTemp?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    heatingStart?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    heatingEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type BoilerHistoryUncheckedUpdateWithoutUserInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    externalTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    suggestedTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    actualTemp?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    heatingStart?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    heatingEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type BoilerHistoryUncheckedUpdateManyWithoutUserInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    externalTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    suggestedTemp?: Prisma.FloatFieldUpdateOperationsInput | number;
    actualTemp?: Prisma.NullableFloatFieldUpdateOperationsInput | number | null;
    heatingStart?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    heatingEnd?: Prisma.NullableDateTimeFieldUpdateOperationsInput | Date | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type BoilerHistorySelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    userId?: boolean;
    externalTemp?: boolean;
    suggestedTemp?: boolean;
    actualTemp?: boolean;
    heatingStart?: boolean;
    heatingEnd?: boolean;
    createdAt?: boolean;
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["boilerHistory"]>;
export type BoilerHistorySelectScalar = {
    id?: boolean;
    userId?: boolean;
    externalTemp?: boolean;
    suggestedTemp?: boolean;
    actualTemp?: boolean;
    heatingStart?: boolean;
    heatingEnd?: boolean;
    createdAt?: boolean;
};
export type BoilerHistoryOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "userId" | "externalTemp" | "suggestedTemp" | "actualTemp" | "heatingStart" | "heatingEnd" | "createdAt", ExtArgs["result"]["boilerHistory"]>;
export type BoilerHistoryInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    user?: boolean | Prisma.UserDefaultArgs<ExtArgs>;
};
export type $BoilerHistoryPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "BoilerHistory";
    objects: {
        user: Prisma.$UserPayload<ExtArgs>;
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: number;
        userId: number;
        externalTemp: number;
        suggestedTemp: number;
        actualTemp: number | null;
        heatingStart: Date | null;
        heatingEnd: Date | null;
        createdAt: Date;
    }, ExtArgs["result"]["boilerHistory"]>;
    composites: {};
};
export type BoilerHistoryGetPayload<S extends boolean | null | undefined | BoilerHistoryDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$BoilerHistoryPayload, S>;
export type BoilerHistoryCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<BoilerHistoryFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: BoilerHistoryCountAggregateInputType | true;
};
export interface BoilerHistoryDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['BoilerHistory'];
        meta: {
            name: 'BoilerHistory';
        };
    };
    findUnique<T extends BoilerHistoryFindUniqueArgs>(args: Prisma.SelectSubset<T, BoilerHistoryFindUniqueArgs<ExtArgs>>): Prisma.Prisma__BoilerHistoryClient<runtime.Types.Result.GetResult<Prisma.$BoilerHistoryPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends BoilerHistoryFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, BoilerHistoryFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__BoilerHistoryClient<runtime.Types.Result.GetResult<Prisma.$BoilerHistoryPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends BoilerHistoryFindFirstArgs>(args?: Prisma.SelectSubset<T, BoilerHistoryFindFirstArgs<ExtArgs>>): Prisma.Prisma__BoilerHistoryClient<runtime.Types.Result.GetResult<Prisma.$BoilerHistoryPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends BoilerHistoryFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, BoilerHistoryFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__BoilerHistoryClient<runtime.Types.Result.GetResult<Prisma.$BoilerHistoryPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends BoilerHistoryFindManyArgs>(args?: Prisma.SelectSubset<T, BoilerHistoryFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$BoilerHistoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends BoilerHistoryCreateArgs>(args: Prisma.SelectSubset<T, BoilerHistoryCreateArgs<ExtArgs>>): Prisma.Prisma__BoilerHistoryClient<runtime.Types.Result.GetResult<Prisma.$BoilerHistoryPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends BoilerHistoryCreateManyArgs>(args?: Prisma.SelectSubset<T, BoilerHistoryCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends BoilerHistoryDeleteArgs>(args: Prisma.SelectSubset<T, BoilerHistoryDeleteArgs<ExtArgs>>): Prisma.Prisma__BoilerHistoryClient<runtime.Types.Result.GetResult<Prisma.$BoilerHistoryPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends BoilerHistoryUpdateArgs>(args: Prisma.SelectSubset<T, BoilerHistoryUpdateArgs<ExtArgs>>): Prisma.Prisma__BoilerHistoryClient<runtime.Types.Result.GetResult<Prisma.$BoilerHistoryPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends BoilerHistoryDeleteManyArgs>(args?: Prisma.SelectSubset<T, BoilerHistoryDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends BoilerHistoryUpdateManyArgs>(args: Prisma.SelectSubset<T, BoilerHistoryUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends BoilerHistoryUpsertArgs>(args: Prisma.SelectSubset<T, BoilerHistoryUpsertArgs<ExtArgs>>): Prisma.Prisma__BoilerHistoryClient<runtime.Types.Result.GetResult<Prisma.$BoilerHistoryPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends BoilerHistoryCountArgs>(args?: Prisma.Subset<T, BoilerHistoryCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], BoilerHistoryCountAggregateOutputType> : number>;
    aggregate<T extends BoilerHistoryAggregateArgs>(args: Prisma.Subset<T, BoilerHistoryAggregateArgs>): Prisma.PrismaPromise<GetBoilerHistoryAggregateType<T>>;
    groupBy<T extends BoilerHistoryGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: BoilerHistoryGroupByArgs['orderBy'];
    } : {
        orderBy?: BoilerHistoryGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, BoilerHistoryGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetBoilerHistoryGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: BoilerHistoryFieldRefs;
}
export interface Prisma__BoilerHistoryClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    user<T extends Prisma.UserDefaultArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.UserDefaultArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions> | Null, Null, ExtArgs, GlobalOmitOptions>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface BoilerHistoryFieldRefs {
    readonly id: Prisma.FieldRef<"BoilerHistory", 'Int'>;
    readonly userId: Prisma.FieldRef<"BoilerHistory", 'Int'>;
    readonly externalTemp: Prisma.FieldRef<"BoilerHistory", 'Float'>;
    readonly suggestedTemp: Prisma.FieldRef<"BoilerHistory", 'Float'>;
    readonly actualTemp: Prisma.FieldRef<"BoilerHistory", 'Float'>;
    readonly heatingStart: Prisma.FieldRef<"BoilerHistory", 'DateTime'>;
    readonly heatingEnd: Prisma.FieldRef<"BoilerHistory", 'DateTime'>;
    readonly createdAt: Prisma.FieldRef<"BoilerHistory", 'DateTime'>;
}
export type BoilerHistoryFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.BoilerHistorySelect<ExtArgs> | null;
    omit?: Prisma.BoilerHistoryOmit<ExtArgs> | null;
    include?: Prisma.BoilerHistoryInclude<ExtArgs> | null;
    where: Prisma.BoilerHistoryWhereUniqueInput;
};
export type BoilerHistoryFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.BoilerHistorySelect<ExtArgs> | null;
    omit?: Prisma.BoilerHistoryOmit<ExtArgs> | null;
    include?: Prisma.BoilerHistoryInclude<ExtArgs> | null;
    where: Prisma.BoilerHistoryWhereUniqueInput;
};
export type BoilerHistoryFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.BoilerHistorySelect<ExtArgs> | null;
    omit?: Prisma.BoilerHistoryOmit<ExtArgs> | null;
    include?: Prisma.BoilerHistoryInclude<ExtArgs> | null;
    where?: Prisma.BoilerHistoryWhereInput;
    orderBy?: Prisma.BoilerHistoryOrderByWithRelationInput | Prisma.BoilerHistoryOrderByWithRelationInput[];
    cursor?: Prisma.BoilerHistoryWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.BoilerHistoryScalarFieldEnum | Prisma.BoilerHistoryScalarFieldEnum[];
};
export type BoilerHistoryFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.BoilerHistorySelect<ExtArgs> | null;
    omit?: Prisma.BoilerHistoryOmit<ExtArgs> | null;
    include?: Prisma.BoilerHistoryInclude<ExtArgs> | null;
    where?: Prisma.BoilerHistoryWhereInput;
    orderBy?: Prisma.BoilerHistoryOrderByWithRelationInput | Prisma.BoilerHistoryOrderByWithRelationInput[];
    cursor?: Prisma.BoilerHistoryWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.BoilerHistoryScalarFieldEnum | Prisma.BoilerHistoryScalarFieldEnum[];
};
export type BoilerHistoryFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.BoilerHistorySelect<ExtArgs> | null;
    omit?: Prisma.BoilerHistoryOmit<ExtArgs> | null;
    include?: Prisma.BoilerHistoryInclude<ExtArgs> | null;
    where?: Prisma.BoilerHistoryWhereInput;
    orderBy?: Prisma.BoilerHistoryOrderByWithRelationInput | Prisma.BoilerHistoryOrderByWithRelationInput[];
    cursor?: Prisma.BoilerHistoryWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.BoilerHistoryScalarFieldEnum | Prisma.BoilerHistoryScalarFieldEnum[];
};
export type BoilerHistoryCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.BoilerHistorySelect<ExtArgs> | null;
    omit?: Prisma.BoilerHistoryOmit<ExtArgs> | null;
    include?: Prisma.BoilerHistoryInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.BoilerHistoryCreateInput, Prisma.BoilerHistoryUncheckedCreateInput>;
};
export type BoilerHistoryCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.BoilerHistoryCreateManyInput | Prisma.BoilerHistoryCreateManyInput[];
    skipDuplicates?: boolean;
};
export type BoilerHistoryUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.BoilerHistorySelect<ExtArgs> | null;
    omit?: Prisma.BoilerHistoryOmit<ExtArgs> | null;
    include?: Prisma.BoilerHistoryInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.BoilerHistoryUpdateInput, Prisma.BoilerHistoryUncheckedUpdateInput>;
    where: Prisma.BoilerHistoryWhereUniqueInput;
};
export type BoilerHistoryUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.BoilerHistoryUpdateManyMutationInput, Prisma.BoilerHistoryUncheckedUpdateManyInput>;
    where?: Prisma.BoilerHistoryWhereInput;
    limit?: number;
};
export type BoilerHistoryUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.BoilerHistorySelect<ExtArgs> | null;
    omit?: Prisma.BoilerHistoryOmit<ExtArgs> | null;
    include?: Prisma.BoilerHistoryInclude<ExtArgs> | null;
    where: Prisma.BoilerHistoryWhereUniqueInput;
    create: Prisma.XOR<Prisma.BoilerHistoryCreateInput, Prisma.BoilerHistoryUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.BoilerHistoryUpdateInput, Prisma.BoilerHistoryUncheckedUpdateInput>;
};
export type BoilerHistoryDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.BoilerHistorySelect<ExtArgs> | null;
    omit?: Prisma.BoilerHistoryOmit<ExtArgs> | null;
    include?: Prisma.BoilerHistoryInclude<ExtArgs> | null;
    where: Prisma.BoilerHistoryWhereUniqueInput;
};
export type BoilerHistoryDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.BoilerHistoryWhereInput;
    limit?: number;
};
export type BoilerHistoryDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.BoilerHistorySelect<ExtArgs> | null;
    omit?: Prisma.BoilerHistoryOmit<ExtArgs> | null;
    include?: Prisma.BoilerHistoryInclude<ExtArgs> | null;
};
export {};
