import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type TuyaTokenModel = runtime.Types.Result.DefaultSelection<Prisma.$TuyaTokenPayload>;
export type AggregateTuyaToken = {
    _count: TuyaTokenCountAggregateOutputType | null;
    _avg: TuyaTokenAvgAggregateOutputType | null;
    _sum: TuyaTokenSumAggregateOutputType | null;
    _min: TuyaTokenMinAggregateOutputType | null;
    _max: TuyaTokenMaxAggregateOutputType | null;
};
export type TuyaTokenAvgAggregateOutputType = {
    id: number | null;
};
export type TuyaTokenSumAggregateOutputType = {
    id: number | null;
};
export type TuyaTokenMinAggregateOutputType = {
    id: number | null;
    accessToken: string | null;
    expiresAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
};
export type TuyaTokenMaxAggregateOutputType = {
    id: number | null;
    accessToken: string | null;
    expiresAt: Date | null;
    createdAt: Date | null;
    updatedAt: Date | null;
};
export type TuyaTokenCountAggregateOutputType = {
    id: number;
    accessToken: number;
    expiresAt: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
};
export type TuyaTokenAvgAggregateInputType = {
    id?: true;
};
export type TuyaTokenSumAggregateInputType = {
    id?: true;
};
export type TuyaTokenMinAggregateInputType = {
    id?: true;
    accessToken?: true;
    expiresAt?: true;
    createdAt?: true;
    updatedAt?: true;
};
export type TuyaTokenMaxAggregateInputType = {
    id?: true;
    accessToken?: true;
    expiresAt?: true;
    createdAt?: true;
    updatedAt?: true;
};
export type TuyaTokenCountAggregateInputType = {
    id?: true;
    accessToken?: true;
    expiresAt?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
};
export type TuyaTokenAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.TuyaTokenWhereInput;
    orderBy?: Prisma.TuyaTokenOrderByWithRelationInput | Prisma.TuyaTokenOrderByWithRelationInput[];
    cursor?: Prisma.TuyaTokenWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | TuyaTokenCountAggregateInputType;
    _avg?: TuyaTokenAvgAggregateInputType;
    _sum?: TuyaTokenSumAggregateInputType;
    _min?: TuyaTokenMinAggregateInputType;
    _max?: TuyaTokenMaxAggregateInputType;
};
export type GetTuyaTokenAggregateType<T extends TuyaTokenAggregateArgs> = {
    [P in keyof T & keyof AggregateTuyaToken]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateTuyaToken[P]> : Prisma.GetScalarType<T[P], AggregateTuyaToken[P]>;
};
export type TuyaTokenGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.TuyaTokenWhereInput;
    orderBy?: Prisma.TuyaTokenOrderByWithAggregationInput | Prisma.TuyaTokenOrderByWithAggregationInput[];
    by: Prisma.TuyaTokenScalarFieldEnum[] | Prisma.TuyaTokenScalarFieldEnum;
    having?: Prisma.TuyaTokenScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: TuyaTokenCountAggregateInputType | true;
    _avg?: TuyaTokenAvgAggregateInputType;
    _sum?: TuyaTokenSumAggregateInputType;
    _min?: TuyaTokenMinAggregateInputType;
    _max?: TuyaTokenMaxAggregateInputType;
};
export type TuyaTokenGroupByOutputType = {
    id: number;
    accessToken: string;
    expiresAt: Date;
    createdAt: Date;
    updatedAt: Date;
    _count: TuyaTokenCountAggregateOutputType | null;
    _avg: TuyaTokenAvgAggregateOutputType | null;
    _sum: TuyaTokenSumAggregateOutputType | null;
    _min: TuyaTokenMinAggregateOutputType | null;
    _max: TuyaTokenMaxAggregateOutputType | null;
};
type GetTuyaTokenGroupByPayload<T extends TuyaTokenGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<TuyaTokenGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof TuyaTokenGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], TuyaTokenGroupByOutputType[P]> : Prisma.GetScalarType<T[P], TuyaTokenGroupByOutputType[P]>;
}>>;
export type TuyaTokenWhereInput = {
    AND?: Prisma.TuyaTokenWhereInput | Prisma.TuyaTokenWhereInput[];
    OR?: Prisma.TuyaTokenWhereInput[];
    NOT?: Prisma.TuyaTokenWhereInput | Prisma.TuyaTokenWhereInput[];
    id?: Prisma.IntFilter<"TuyaToken"> | number;
    accessToken?: Prisma.StringFilter<"TuyaToken"> | string;
    expiresAt?: Prisma.DateTimeFilter<"TuyaToken"> | Date | string;
    createdAt?: Prisma.DateTimeFilter<"TuyaToken"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"TuyaToken"> | Date | string;
};
export type TuyaTokenOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    accessToken?: Prisma.SortOrder;
    expiresAt?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    _relevance?: Prisma.TuyaTokenOrderByRelevanceInput;
};
export type TuyaTokenWhereUniqueInput = Prisma.AtLeast<{
    id?: number;
    AND?: Prisma.TuyaTokenWhereInput | Prisma.TuyaTokenWhereInput[];
    OR?: Prisma.TuyaTokenWhereInput[];
    NOT?: Prisma.TuyaTokenWhereInput | Prisma.TuyaTokenWhereInput[];
    accessToken?: Prisma.StringFilter<"TuyaToken"> | string;
    expiresAt?: Prisma.DateTimeFilter<"TuyaToken"> | Date | string;
    createdAt?: Prisma.DateTimeFilter<"TuyaToken"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"TuyaToken"> | Date | string;
}, "id">;
export type TuyaTokenOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    accessToken?: Prisma.SortOrder;
    expiresAt?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    _count?: Prisma.TuyaTokenCountOrderByAggregateInput;
    _avg?: Prisma.TuyaTokenAvgOrderByAggregateInput;
    _max?: Prisma.TuyaTokenMaxOrderByAggregateInput;
    _min?: Prisma.TuyaTokenMinOrderByAggregateInput;
    _sum?: Prisma.TuyaTokenSumOrderByAggregateInput;
};
export type TuyaTokenScalarWhereWithAggregatesInput = {
    AND?: Prisma.TuyaTokenScalarWhereWithAggregatesInput | Prisma.TuyaTokenScalarWhereWithAggregatesInput[];
    OR?: Prisma.TuyaTokenScalarWhereWithAggregatesInput[];
    NOT?: Prisma.TuyaTokenScalarWhereWithAggregatesInput | Prisma.TuyaTokenScalarWhereWithAggregatesInput[];
    id?: Prisma.IntWithAggregatesFilter<"TuyaToken"> | number;
    accessToken?: Prisma.StringWithAggregatesFilter<"TuyaToken"> | string;
    expiresAt?: Prisma.DateTimeWithAggregatesFilter<"TuyaToken"> | Date | string;
    createdAt?: Prisma.DateTimeWithAggregatesFilter<"TuyaToken"> | Date | string;
    updatedAt?: Prisma.DateTimeWithAggregatesFilter<"TuyaToken"> | Date | string;
};
export type TuyaTokenCreateInput = {
    accessToken: string;
    expiresAt: Date | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};
export type TuyaTokenUncheckedCreateInput = {
    id?: number;
    accessToken: string;
    expiresAt: Date | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};
export type TuyaTokenUpdateInput = {
    accessToken?: Prisma.StringFieldUpdateOperationsInput | string;
    expiresAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type TuyaTokenUncheckedUpdateInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    accessToken?: Prisma.StringFieldUpdateOperationsInput | string;
    expiresAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type TuyaTokenCreateManyInput = {
    id?: number;
    accessToken: string;
    expiresAt: Date | string;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};
export type TuyaTokenUpdateManyMutationInput = {
    accessToken?: Prisma.StringFieldUpdateOperationsInput | string;
    expiresAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type TuyaTokenUncheckedUpdateManyInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    accessToken?: Prisma.StringFieldUpdateOperationsInput | string;
    expiresAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type TuyaTokenOrderByRelevanceInput = {
    fields: Prisma.TuyaTokenOrderByRelevanceFieldEnum | Prisma.TuyaTokenOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type TuyaTokenCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    accessToken?: Prisma.SortOrder;
    expiresAt?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type TuyaTokenAvgOrderByAggregateInput = {
    id?: Prisma.SortOrder;
};
export type TuyaTokenMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    accessToken?: Prisma.SortOrder;
    expiresAt?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type TuyaTokenMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    accessToken?: Prisma.SortOrder;
    expiresAt?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type TuyaTokenSumOrderByAggregateInput = {
    id?: Prisma.SortOrder;
};
export type TuyaTokenSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    accessToken?: boolean;
    expiresAt?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
}, ExtArgs["result"]["tuyaToken"]>;
export type TuyaTokenSelectScalar = {
    id?: boolean;
    accessToken?: boolean;
    expiresAt?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
};
export type TuyaTokenOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "accessToken" | "expiresAt" | "createdAt" | "updatedAt", ExtArgs["result"]["tuyaToken"]>;
export type $TuyaTokenPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "TuyaToken";
    objects: {};
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: number;
        accessToken: string;
        expiresAt: Date;
        createdAt: Date;
        updatedAt: Date;
    }, ExtArgs["result"]["tuyaToken"]>;
    composites: {};
};
export type TuyaTokenGetPayload<S extends boolean | null | undefined | TuyaTokenDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$TuyaTokenPayload, S>;
export type TuyaTokenCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<TuyaTokenFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: TuyaTokenCountAggregateInputType | true;
};
export interface TuyaTokenDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['TuyaToken'];
        meta: {
            name: 'TuyaToken';
        };
    };
    findUnique<T extends TuyaTokenFindUniqueArgs>(args: Prisma.SelectSubset<T, TuyaTokenFindUniqueArgs<ExtArgs>>): Prisma.Prisma__TuyaTokenClient<runtime.Types.Result.GetResult<Prisma.$TuyaTokenPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends TuyaTokenFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, TuyaTokenFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__TuyaTokenClient<runtime.Types.Result.GetResult<Prisma.$TuyaTokenPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends TuyaTokenFindFirstArgs>(args?: Prisma.SelectSubset<T, TuyaTokenFindFirstArgs<ExtArgs>>): Prisma.Prisma__TuyaTokenClient<runtime.Types.Result.GetResult<Prisma.$TuyaTokenPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends TuyaTokenFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, TuyaTokenFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__TuyaTokenClient<runtime.Types.Result.GetResult<Prisma.$TuyaTokenPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends TuyaTokenFindManyArgs>(args?: Prisma.SelectSubset<T, TuyaTokenFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$TuyaTokenPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends TuyaTokenCreateArgs>(args: Prisma.SelectSubset<T, TuyaTokenCreateArgs<ExtArgs>>): Prisma.Prisma__TuyaTokenClient<runtime.Types.Result.GetResult<Prisma.$TuyaTokenPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends TuyaTokenCreateManyArgs>(args?: Prisma.SelectSubset<T, TuyaTokenCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends TuyaTokenDeleteArgs>(args: Prisma.SelectSubset<T, TuyaTokenDeleteArgs<ExtArgs>>): Prisma.Prisma__TuyaTokenClient<runtime.Types.Result.GetResult<Prisma.$TuyaTokenPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends TuyaTokenUpdateArgs>(args: Prisma.SelectSubset<T, TuyaTokenUpdateArgs<ExtArgs>>): Prisma.Prisma__TuyaTokenClient<runtime.Types.Result.GetResult<Prisma.$TuyaTokenPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends TuyaTokenDeleteManyArgs>(args?: Prisma.SelectSubset<T, TuyaTokenDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends TuyaTokenUpdateManyArgs>(args: Prisma.SelectSubset<T, TuyaTokenUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends TuyaTokenUpsertArgs>(args: Prisma.SelectSubset<T, TuyaTokenUpsertArgs<ExtArgs>>): Prisma.Prisma__TuyaTokenClient<runtime.Types.Result.GetResult<Prisma.$TuyaTokenPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends TuyaTokenCountArgs>(args?: Prisma.Subset<T, TuyaTokenCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], TuyaTokenCountAggregateOutputType> : number>;
    aggregate<T extends TuyaTokenAggregateArgs>(args: Prisma.Subset<T, TuyaTokenAggregateArgs>): Prisma.PrismaPromise<GetTuyaTokenAggregateType<T>>;
    groupBy<T extends TuyaTokenGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: TuyaTokenGroupByArgs['orderBy'];
    } : {
        orderBy?: TuyaTokenGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, TuyaTokenGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetTuyaTokenGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: TuyaTokenFieldRefs;
}
export interface Prisma__TuyaTokenClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface TuyaTokenFieldRefs {
    readonly id: Prisma.FieldRef<"TuyaToken", 'Int'>;
    readonly accessToken: Prisma.FieldRef<"TuyaToken", 'String'>;
    readonly expiresAt: Prisma.FieldRef<"TuyaToken", 'DateTime'>;
    readonly createdAt: Prisma.FieldRef<"TuyaToken", 'DateTime'>;
    readonly updatedAt: Prisma.FieldRef<"TuyaToken", 'DateTime'>;
}
export type TuyaTokenFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.TuyaTokenSelect<ExtArgs> | null;
    omit?: Prisma.TuyaTokenOmit<ExtArgs> | null;
    where: Prisma.TuyaTokenWhereUniqueInput;
};
export type TuyaTokenFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.TuyaTokenSelect<ExtArgs> | null;
    omit?: Prisma.TuyaTokenOmit<ExtArgs> | null;
    where: Prisma.TuyaTokenWhereUniqueInput;
};
export type TuyaTokenFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.TuyaTokenSelect<ExtArgs> | null;
    omit?: Prisma.TuyaTokenOmit<ExtArgs> | null;
    where?: Prisma.TuyaTokenWhereInput;
    orderBy?: Prisma.TuyaTokenOrderByWithRelationInput | Prisma.TuyaTokenOrderByWithRelationInput[];
    cursor?: Prisma.TuyaTokenWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.TuyaTokenScalarFieldEnum | Prisma.TuyaTokenScalarFieldEnum[];
};
export type TuyaTokenFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.TuyaTokenSelect<ExtArgs> | null;
    omit?: Prisma.TuyaTokenOmit<ExtArgs> | null;
    where?: Prisma.TuyaTokenWhereInput;
    orderBy?: Prisma.TuyaTokenOrderByWithRelationInput | Prisma.TuyaTokenOrderByWithRelationInput[];
    cursor?: Prisma.TuyaTokenWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.TuyaTokenScalarFieldEnum | Prisma.TuyaTokenScalarFieldEnum[];
};
export type TuyaTokenFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.TuyaTokenSelect<ExtArgs> | null;
    omit?: Prisma.TuyaTokenOmit<ExtArgs> | null;
    where?: Prisma.TuyaTokenWhereInput;
    orderBy?: Prisma.TuyaTokenOrderByWithRelationInput | Prisma.TuyaTokenOrderByWithRelationInput[];
    cursor?: Prisma.TuyaTokenWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.TuyaTokenScalarFieldEnum | Prisma.TuyaTokenScalarFieldEnum[];
};
export type TuyaTokenCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.TuyaTokenSelect<ExtArgs> | null;
    omit?: Prisma.TuyaTokenOmit<ExtArgs> | null;
    data: Prisma.XOR<Prisma.TuyaTokenCreateInput, Prisma.TuyaTokenUncheckedCreateInput>;
};
export type TuyaTokenCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.TuyaTokenCreateManyInput | Prisma.TuyaTokenCreateManyInput[];
    skipDuplicates?: boolean;
};
export type TuyaTokenUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.TuyaTokenSelect<ExtArgs> | null;
    omit?: Prisma.TuyaTokenOmit<ExtArgs> | null;
    data: Prisma.XOR<Prisma.TuyaTokenUpdateInput, Prisma.TuyaTokenUncheckedUpdateInput>;
    where: Prisma.TuyaTokenWhereUniqueInput;
};
export type TuyaTokenUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.TuyaTokenUpdateManyMutationInput, Prisma.TuyaTokenUncheckedUpdateManyInput>;
    where?: Prisma.TuyaTokenWhereInput;
    limit?: number;
};
export type TuyaTokenUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.TuyaTokenSelect<ExtArgs> | null;
    omit?: Prisma.TuyaTokenOmit<ExtArgs> | null;
    where: Prisma.TuyaTokenWhereUniqueInput;
    create: Prisma.XOR<Prisma.TuyaTokenCreateInput, Prisma.TuyaTokenUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.TuyaTokenUpdateInput, Prisma.TuyaTokenUncheckedUpdateInput>;
};
export type TuyaTokenDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.TuyaTokenSelect<ExtArgs> | null;
    omit?: Prisma.TuyaTokenOmit<ExtArgs> | null;
    where: Prisma.TuyaTokenWhereUniqueInput;
};
export type TuyaTokenDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.TuyaTokenWhereInput;
    limit?: number;
};
export type TuyaTokenDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.TuyaTokenSelect<ExtArgs> | null;
    omit?: Prisma.TuyaTokenOmit<ExtArgs> | null;
};
export {};
