import type * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../internal/prismaNamespace.js";
export type UserModel = runtime.Types.Result.DefaultSelection<Prisma.$UserPayload>;
export type AggregateUser = {
    _count: UserCountAggregateOutputType | null;
    _avg: UserAvgAggregateOutputType | null;
    _sum: UserSumAggregateOutputType | null;
    _min: UserMinAggregateOutputType | null;
    _max: UserMaxAggregateOutputType | null;
};
export type UserAvgAggregateOutputType = {
    id: number | null;
};
export type UserSumAggregateOutputType = {
    id: number | null;
};
export type UserMinAggregateOutputType = {
    id: number | null;
    email: string | null;
    passwordHash: string | null;
    name: string | null;
    homeLocation: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
};
export type UserMaxAggregateOutputType = {
    id: number | null;
    email: string | null;
    passwordHash: string | null;
    name: string | null;
    homeLocation: string | null;
    createdAt: Date | null;
    updatedAt: Date | null;
};
export type UserCountAggregateOutputType = {
    id: number;
    email: number;
    passwordHash: number;
    name: number;
    homeLocation: number;
    createdAt: number;
    updatedAt: number;
    _all: number;
};
export type UserAvgAggregateInputType = {
    id?: true;
};
export type UserSumAggregateInputType = {
    id?: true;
};
export type UserMinAggregateInputType = {
    id?: true;
    email?: true;
    passwordHash?: true;
    name?: true;
    homeLocation?: true;
    createdAt?: true;
    updatedAt?: true;
};
export type UserMaxAggregateInputType = {
    id?: true;
    email?: true;
    passwordHash?: true;
    name?: true;
    homeLocation?: true;
    createdAt?: true;
    updatedAt?: true;
};
export type UserCountAggregateInputType = {
    id?: true;
    email?: true;
    passwordHash?: true;
    name?: true;
    homeLocation?: true;
    createdAt?: true;
    updatedAt?: true;
    _all?: true;
};
export type UserAggregateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[];
    cursor?: Prisma.UserWhereUniqueInput;
    take?: number;
    skip?: number;
    _count?: true | UserCountAggregateInputType;
    _avg?: UserAvgAggregateInputType;
    _sum?: UserSumAggregateInputType;
    _min?: UserMinAggregateInputType;
    _max?: UserMaxAggregateInputType;
};
export type GetUserAggregateType<T extends UserAggregateArgs> = {
    [P in keyof T & keyof AggregateUser]: P extends '_count' | 'count' ? T[P] extends true ? number : Prisma.GetScalarType<T[P], AggregateUser[P]> : Prisma.GetScalarType<T[P], AggregateUser[P]>;
};
export type UserGroupByArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithAggregationInput | Prisma.UserOrderByWithAggregationInput[];
    by: Prisma.UserScalarFieldEnum[] | Prisma.UserScalarFieldEnum;
    having?: Prisma.UserScalarWhereWithAggregatesInput;
    take?: number;
    skip?: number;
    _count?: UserCountAggregateInputType | true;
    _avg?: UserAvgAggregateInputType;
    _sum?: UserSumAggregateInputType;
    _min?: UserMinAggregateInputType;
    _max?: UserMaxAggregateInputType;
};
export type UserGroupByOutputType = {
    id: number;
    email: string;
    passwordHash: string;
    name: string | null;
    homeLocation: string | null;
    createdAt: Date;
    updatedAt: Date;
    _count: UserCountAggregateOutputType | null;
    _avg: UserAvgAggregateOutputType | null;
    _sum: UserSumAggregateOutputType | null;
    _min: UserMinAggregateOutputType | null;
    _max: UserMaxAggregateOutputType | null;
};
type GetUserGroupByPayload<T extends UserGroupByArgs> = Prisma.PrismaPromise<Array<Prisma.PickEnumerable<UserGroupByOutputType, T['by']> & {
    [P in ((keyof T) & (keyof UserGroupByOutputType))]: P extends '_count' ? T[P] extends boolean ? number : Prisma.GetScalarType<T[P], UserGroupByOutputType[P]> : Prisma.GetScalarType<T[P], UserGroupByOutputType[P]>;
}>>;
export type UserWhereInput = {
    AND?: Prisma.UserWhereInput | Prisma.UserWhereInput[];
    OR?: Prisma.UserWhereInput[];
    NOT?: Prisma.UserWhereInput | Prisma.UserWhereInput[];
    id?: Prisma.IntFilter<"User"> | number;
    email?: Prisma.StringFilter<"User"> | string;
    passwordHash?: Prisma.StringFilter<"User"> | string;
    name?: Prisma.StringNullableFilter<"User"> | string | null;
    homeLocation?: Prisma.StringNullableFilter<"User"> | string | null;
    createdAt?: Prisma.DateTimeFilter<"User"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"User"> | Date | string;
    homeProfiles?: Prisma.HomeProfileListRelationFilter;
    thermostatDevices?: Prisma.ThermostatDeviceListRelationFilter;
    recommendations?: Prisma.RecommendationListRelationFilter;
    boilerHistories?: Prisma.BoilerHistoryListRelationFilter;
};
export type UserOrderByWithRelationInput = {
    id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    passwordHash?: Prisma.SortOrder;
    name?: Prisma.SortOrderInput | Prisma.SortOrder;
    homeLocation?: Prisma.SortOrderInput | Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    homeProfiles?: Prisma.HomeProfileOrderByRelationAggregateInput;
    thermostatDevices?: Prisma.ThermostatDeviceOrderByRelationAggregateInput;
    recommendations?: Prisma.RecommendationOrderByRelationAggregateInput;
    boilerHistories?: Prisma.BoilerHistoryOrderByRelationAggregateInput;
    _relevance?: Prisma.UserOrderByRelevanceInput;
};
export type UserWhereUniqueInput = Prisma.AtLeast<{
    id?: number;
    email?: string;
    AND?: Prisma.UserWhereInput | Prisma.UserWhereInput[];
    OR?: Prisma.UserWhereInput[];
    NOT?: Prisma.UserWhereInput | Prisma.UserWhereInput[];
    passwordHash?: Prisma.StringFilter<"User"> | string;
    name?: Prisma.StringNullableFilter<"User"> | string | null;
    homeLocation?: Prisma.StringNullableFilter<"User"> | string | null;
    createdAt?: Prisma.DateTimeFilter<"User"> | Date | string;
    updatedAt?: Prisma.DateTimeFilter<"User"> | Date | string;
    homeProfiles?: Prisma.HomeProfileListRelationFilter;
    thermostatDevices?: Prisma.ThermostatDeviceListRelationFilter;
    recommendations?: Prisma.RecommendationListRelationFilter;
    boilerHistories?: Prisma.BoilerHistoryListRelationFilter;
}, "id" | "email">;
export type UserOrderByWithAggregationInput = {
    id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    passwordHash?: Prisma.SortOrder;
    name?: Prisma.SortOrderInput | Prisma.SortOrder;
    homeLocation?: Prisma.SortOrderInput | Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
    _count?: Prisma.UserCountOrderByAggregateInput;
    _avg?: Prisma.UserAvgOrderByAggregateInput;
    _max?: Prisma.UserMaxOrderByAggregateInput;
    _min?: Prisma.UserMinOrderByAggregateInput;
    _sum?: Prisma.UserSumOrderByAggregateInput;
};
export type UserScalarWhereWithAggregatesInput = {
    AND?: Prisma.UserScalarWhereWithAggregatesInput | Prisma.UserScalarWhereWithAggregatesInput[];
    OR?: Prisma.UserScalarWhereWithAggregatesInput[];
    NOT?: Prisma.UserScalarWhereWithAggregatesInput | Prisma.UserScalarWhereWithAggregatesInput[];
    id?: Prisma.IntWithAggregatesFilter<"User"> | number;
    email?: Prisma.StringWithAggregatesFilter<"User"> | string;
    passwordHash?: Prisma.StringWithAggregatesFilter<"User"> | string;
    name?: Prisma.StringNullableWithAggregatesFilter<"User"> | string | null;
    homeLocation?: Prisma.StringNullableWithAggregatesFilter<"User"> | string | null;
    createdAt?: Prisma.DateTimeWithAggregatesFilter<"User"> | Date | string;
    updatedAt?: Prisma.DateTimeWithAggregatesFilter<"User"> | Date | string;
};
export type UserCreateInput = {
    email: string;
    passwordHash: string;
    name?: string | null;
    homeLocation?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    homeProfiles?: Prisma.HomeProfileCreateNestedManyWithoutUserInput;
    thermostatDevices?: Prisma.ThermostatDeviceCreateNestedManyWithoutUserInput;
    recommendations?: Prisma.RecommendationCreateNestedManyWithoutUserInput;
    boilerHistories?: Prisma.BoilerHistoryCreateNestedManyWithoutUserInput;
};
export type UserUncheckedCreateInput = {
    id?: number;
    email: string;
    passwordHash: string;
    name?: string | null;
    homeLocation?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    homeProfiles?: Prisma.HomeProfileUncheckedCreateNestedManyWithoutUserInput;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedCreateNestedManyWithoutUserInput;
    recommendations?: Prisma.RecommendationUncheckedCreateNestedManyWithoutUserInput;
    boilerHistories?: Prisma.BoilerHistoryUncheckedCreateNestedManyWithoutUserInput;
};
export type UserUpdateInput = {
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    homeProfiles?: Prisma.HomeProfileUpdateManyWithoutUserNestedInput;
    thermostatDevices?: Prisma.ThermostatDeviceUpdateManyWithoutUserNestedInput;
    recommendations?: Prisma.RecommendationUpdateManyWithoutUserNestedInput;
    boilerHistories?: Prisma.BoilerHistoryUpdateManyWithoutUserNestedInput;
};
export type UserUncheckedUpdateInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    homeProfiles?: Prisma.HomeProfileUncheckedUpdateManyWithoutUserNestedInput;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedUpdateManyWithoutUserNestedInput;
    recommendations?: Prisma.RecommendationUncheckedUpdateManyWithoutUserNestedInput;
    boilerHistories?: Prisma.BoilerHistoryUncheckedUpdateManyWithoutUserNestedInput;
};
export type UserCreateManyInput = {
    id?: number;
    email: string;
    passwordHash: string;
    name?: string | null;
    homeLocation?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
};
export type UserUpdateManyMutationInput = {
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type UserUncheckedUpdateManyInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
};
export type UserOrderByRelevanceInput = {
    fields: Prisma.UserOrderByRelevanceFieldEnum | Prisma.UserOrderByRelevanceFieldEnum[];
    sort: Prisma.SortOrder;
    search: string;
};
export type UserCountOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    passwordHash?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    homeLocation?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type UserAvgOrderByAggregateInput = {
    id?: Prisma.SortOrder;
};
export type UserMaxOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    passwordHash?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    homeLocation?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type UserMinOrderByAggregateInput = {
    id?: Prisma.SortOrder;
    email?: Prisma.SortOrder;
    passwordHash?: Prisma.SortOrder;
    name?: Prisma.SortOrder;
    homeLocation?: Prisma.SortOrder;
    createdAt?: Prisma.SortOrder;
    updatedAt?: Prisma.SortOrder;
};
export type UserSumOrderByAggregateInput = {
    id?: Prisma.SortOrder;
};
export type UserScalarRelationFilter = {
    is?: Prisma.UserWhereInput;
    isNot?: Prisma.UserWhereInput;
};
export type StringFieldUpdateOperationsInput = {
    set?: string;
};
export type NullableStringFieldUpdateOperationsInput = {
    set?: string | null;
};
export type DateTimeFieldUpdateOperationsInput = {
    set?: Date | string;
};
export type IntFieldUpdateOperationsInput = {
    set?: number;
    increment?: number;
    decrement?: number;
    multiply?: number;
    divide?: number;
};
export type UserCreateNestedOneWithoutHomeProfilesInput = {
    create?: Prisma.XOR<Prisma.UserCreateWithoutHomeProfilesInput, Prisma.UserUncheckedCreateWithoutHomeProfilesInput>;
    connectOrCreate?: Prisma.UserCreateOrConnectWithoutHomeProfilesInput;
    connect?: Prisma.UserWhereUniqueInput;
};
export type UserUpdateOneRequiredWithoutHomeProfilesNestedInput = {
    create?: Prisma.XOR<Prisma.UserCreateWithoutHomeProfilesInput, Prisma.UserUncheckedCreateWithoutHomeProfilesInput>;
    connectOrCreate?: Prisma.UserCreateOrConnectWithoutHomeProfilesInput;
    upsert?: Prisma.UserUpsertWithoutHomeProfilesInput;
    connect?: Prisma.UserWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.UserUpdateToOneWithWhereWithoutHomeProfilesInput, Prisma.UserUpdateWithoutHomeProfilesInput>, Prisma.UserUncheckedUpdateWithoutHomeProfilesInput>;
};
export type UserCreateNestedOneWithoutThermostatDevicesInput = {
    create?: Prisma.XOR<Prisma.UserCreateWithoutThermostatDevicesInput, Prisma.UserUncheckedCreateWithoutThermostatDevicesInput>;
    connectOrCreate?: Prisma.UserCreateOrConnectWithoutThermostatDevicesInput;
    connect?: Prisma.UserWhereUniqueInput;
};
export type UserUpdateOneRequiredWithoutThermostatDevicesNestedInput = {
    create?: Prisma.XOR<Prisma.UserCreateWithoutThermostatDevicesInput, Prisma.UserUncheckedCreateWithoutThermostatDevicesInput>;
    connectOrCreate?: Prisma.UserCreateOrConnectWithoutThermostatDevicesInput;
    upsert?: Prisma.UserUpsertWithoutThermostatDevicesInput;
    connect?: Prisma.UserWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.UserUpdateToOneWithWhereWithoutThermostatDevicesInput, Prisma.UserUpdateWithoutThermostatDevicesInput>, Prisma.UserUncheckedUpdateWithoutThermostatDevicesInput>;
};
export type UserCreateNestedOneWithoutRecommendationsInput = {
    create?: Prisma.XOR<Prisma.UserCreateWithoutRecommendationsInput, Prisma.UserUncheckedCreateWithoutRecommendationsInput>;
    connectOrCreate?: Prisma.UserCreateOrConnectWithoutRecommendationsInput;
    connect?: Prisma.UserWhereUniqueInput;
};
export type UserUpdateOneRequiredWithoutRecommendationsNestedInput = {
    create?: Prisma.XOR<Prisma.UserCreateWithoutRecommendationsInput, Prisma.UserUncheckedCreateWithoutRecommendationsInput>;
    connectOrCreate?: Prisma.UserCreateOrConnectWithoutRecommendationsInput;
    upsert?: Prisma.UserUpsertWithoutRecommendationsInput;
    connect?: Prisma.UserWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.UserUpdateToOneWithWhereWithoutRecommendationsInput, Prisma.UserUpdateWithoutRecommendationsInput>, Prisma.UserUncheckedUpdateWithoutRecommendationsInput>;
};
export type UserCreateNestedOneWithoutBoilerHistoriesInput = {
    create?: Prisma.XOR<Prisma.UserCreateWithoutBoilerHistoriesInput, Prisma.UserUncheckedCreateWithoutBoilerHistoriesInput>;
    connectOrCreate?: Prisma.UserCreateOrConnectWithoutBoilerHistoriesInput;
    connect?: Prisma.UserWhereUniqueInput;
};
export type UserUpdateOneRequiredWithoutBoilerHistoriesNestedInput = {
    create?: Prisma.XOR<Prisma.UserCreateWithoutBoilerHistoriesInput, Prisma.UserUncheckedCreateWithoutBoilerHistoriesInput>;
    connectOrCreate?: Prisma.UserCreateOrConnectWithoutBoilerHistoriesInput;
    upsert?: Prisma.UserUpsertWithoutBoilerHistoriesInput;
    connect?: Prisma.UserWhereUniqueInput;
    update?: Prisma.XOR<Prisma.XOR<Prisma.UserUpdateToOneWithWhereWithoutBoilerHistoriesInput, Prisma.UserUpdateWithoutBoilerHistoriesInput>, Prisma.UserUncheckedUpdateWithoutBoilerHistoriesInput>;
};
export type UserCreateWithoutHomeProfilesInput = {
    email: string;
    passwordHash: string;
    name?: string | null;
    homeLocation?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceCreateNestedManyWithoutUserInput;
    recommendations?: Prisma.RecommendationCreateNestedManyWithoutUserInput;
    boilerHistories?: Prisma.BoilerHistoryCreateNestedManyWithoutUserInput;
};
export type UserUncheckedCreateWithoutHomeProfilesInput = {
    id?: number;
    email: string;
    passwordHash: string;
    name?: string | null;
    homeLocation?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedCreateNestedManyWithoutUserInput;
    recommendations?: Prisma.RecommendationUncheckedCreateNestedManyWithoutUserInput;
    boilerHistories?: Prisma.BoilerHistoryUncheckedCreateNestedManyWithoutUserInput;
};
export type UserCreateOrConnectWithoutHomeProfilesInput = {
    where: Prisma.UserWhereUniqueInput;
    create: Prisma.XOR<Prisma.UserCreateWithoutHomeProfilesInput, Prisma.UserUncheckedCreateWithoutHomeProfilesInput>;
};
export type UserUpsertWithoutHomeProfilesInput = {
    update: Prisma.XOR<Prisma.UserUpdateWithoutHomeProfilesInput, Prisma.UserUncheckedUpdateWithoutHomeProfilesInput>;
    create: Prisma.XOR<Prisma.UserCreateWithoutHomeProfilesInput, Prisma.UserUncheckedCreateWithoutHomeProfilesInput>;
    where?: Prisma.UserWhereInput;
};
export type UserUpdateToOneWithWhereWithoutHomeProfilesInput = {
    where?: Prisma.UserWhereInput;
    data: Prisma.XOR<Prisma.UserUpdateWithoutHomeProfilesInput, Prisma.UserUncheckedUpdateWithoutHomeProfilesInput>;
};
export type UserUpdateWithoutHomeProfilesInput = {
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceUpdateManyWithoutUserNestedInput;
    recommendations?: Prisma.RecommendationUpdateManyWithoutUserNestedInput;
    boilerHistories?: Prisma.BoilerHistoryUpdateManyWithoutUserNestedInput;
};
export type UserUncheckedUpdateWithoutHomeProfilesInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedUpdateManyWithoutUserNestedInput;
    recommendations?: Prisma.RecommendationUncheckedUpdateManyWithoutUserNestedInput;
    boilerHistories?: Prisma.BoilerHistoryUncheckedUpdateManyWithoutUserNestedInput;
};
export type UserCreateWithoutThermostatDevicesInput = {
    email: string;
    passwordHash: string;
    name?: string | null;
    homeLocation?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    homeProfiles?: Prisma.HomeProfileCreateNestedManyWithoutUserInput;
    recommendations?: Prisma.RecommendationCreateNestedManyWithoutUserInput;
    boilerHistories?: Prisma.BoilerHistoryCreateNestedManyWithoutUserInput;
};
export type UserUncheckedCreateWithoutThermostatDevicesInput = {
    id?: number;
    email: string;
    passwordHash: string;
    name?: string | null;
    homeLocation?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    homeProfiles?: Prisma.HomeProfileUncheckedCreateNestedManyWithoutUserInput;
    recommendations?: Prisma.RecommendationUncheckedCreateNestedManyWithoutUserInput;
    boilerHistories?: Prisma.BoilerHistoryUncheckedCreateNestedManyWithoutUserInput;
};
export type UserCreateOrConnectWithoutThermostatDevicesInput = {
    where: Prisma.UserWhereUniqueInput;
    create: Prisma.XOR<Prisma.UserCreateWithoutThermostatDevicesInput, Prisma.UserUncheckedCreateWithoutThermostatDevicesInput>;
};
export type UserUpsertWithoutThermostatDevicesInput = {
    update: Prisma.XOR<Prisma.UserUpdateWithoutThermostatDevicesInput, Prisma.UserUncheckedUpdateWithoutThermostatDevicesInput>;
    create: Prisma.XOR<Prisma.UserCreateWithoutThermostatDevicesInput, Prisma.UserUncheckedCreateWithoutThermostatDevicesInput>;
    where?: Prisma.UserWhereInput;
};
export type UserUpdateToOneWithWhereWithoutThermostatDevicesInput = {
    where?: Prisma.UserWhereInput;
    data: Prisma.XOR<Prisma.UserUpdateWithoutThermostatDevicesInput, Prisma.UserUncheckedUpdateWithoutThermostatDevicesInput>;
};
export type UserUpdateWithoutThermostatDevicesInput = {
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    homeProfiles?: Prisma.HomeProfileUpdateManyWithoutUserNestedInput;
    recommendations?: Prisma.RecommendationUpdateManyWithoutUserNestedInput;
    boilerHistories?: Prisma.BoilerHistoryUpdateManyWithoutUserNestedInput;
};
export type UserUncheckedUpdateWithoutThermostatDevicesInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    homeProfiles?: Prisma.HomeProfileUncheckedUpdateManyWithoutUserNestedInput;
    recommendations?: Prisma.RecommendationUncheckedUpdateManyWithoutUserNestedInput;
    boilerHistories?: Prisma.BoilerHistoryUncheckedUpdateManyWithoutUserNestedInput;
};
export type UserCreateWithoutRecommendationsInput = {
    email: string;
    passwordHash: string;
    name?: string | null;
    homeLocation?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    homeProfiles?: Prisma.HomeProfileCreateNestedManyWithoutUserInput;
    thermostatDevices?: Prisma.ThermostatDeviceCreateNestedManyWithoutUserInput;
    boilerHistories?: Prisma.BoilerHistoryCreateNestedManyWithoutUserInput;
};
export type UserUncheckedCreateWithoutRecommendationsInput = {
    id?: number;
    email: string;
    passwordHash: string;
    name?: string | null;
    homeLocation?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    homeProfiles?: Prisma.HomeProfileUncheckedCreateNestedManyWithoutUserInput;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedCreateNestedManyWithoutUserInput;
    boilerHistories?: Prisma.BoilerHistoryUncheckedCreateNestedManyWithoutUserInput;
};
export type UserCreateOrConnectWithoutRecommendationsInput = {
    where: Prisma.UserWhereUniqueInput;
    create: Prisma.XOR<Prisma.UserCreateWithoutRecommendationsInput, Prisma.UserUncheckedCreateWithoutRecommendationsInput>;
};
export type UserUpsertWithoutRecommendationsInput = {
    update: Prisma.XOR<Prisma.UserUpdateWithoutRecommendationsInput, Prisma.UserUncheckedUpdateWithoutRecommendationsInput>;
    create: Prisma.XOR<Prisma.UserCreateWithoutRecommendationsInput, Prisma.UserUncheckedCreateWithoutRecommendationsInput>;
    where?: Prisma.UserWhereInput;
};
export type UserUpdateToOneWithWhereWithoutRecommendationsInput = {
    where?: Prisma.UserWhereInput;
    data: Prisma.XOR<Prisma.UserUpdateWithoutRecommendationsInput, Prisma.UserUncheckedUpdateWithoutRecommendationsInput>;
};
export type UserUpdateWithoutRecommendationsInput = {
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    homeProfiles?: Prisma.HomeProfileUpdateManyWithoutUserNestedInput;
    thermostatDevices?: Prisma.ThermostatDeviceUpdateManyWithoutUserNestedInput;
    boilerHistories?: Prisma.BoilerHistoryUpdateManyWithoutUserNestedInput;
};
export type UserUncheckedUpdateWithoutRecommendationsInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    homeProfiles?: Prisma.HomeProfileUncheckedUpdateManyWithoutUserNestedInput;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedUpdateManyWithoutUserNestedInput;
    boilerHistories?: Prisma.BoilerHistoryUncheckedUpdateManyWithoutUserNestedInput;
};
export type UserCreateWithoutBoilerHistoriesInput = {
    email: string;
    passwordHash: string;
    name?: string | null;
    homeLocation?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    homeProfiles?: Prisma.HomeProfileCreateNestedManyWithoutUserInput;
    thermostatDevices?: Prisma.ThermostatDeviceCreateNestedManyWithoutUserInput;
    recommendations?: Prisma.RecommendationCreateNestedManyWithoutUserInput;
};
export type UserUncheckedCreateWithoutBoilerHistoriesInput = {
    id?: number;
    email: string;
    passwordHash: string;
    name?: string | null;
    homeLocation?: string | null;
    createdAt?: Date | string;
    updatedAt?: Date | string;
    homeProfiles?: Prisma.HomeProfileUncheckedCreateNestedManyWithoutUserInput;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedCreateNestedManyWithoutUserInput;
    recommendations?: Prisma.RecommendationUncheckedCreateNestedManyWithoutUserInput;
};
export type UserCreateOrConnectWithoutBoilerHistoriesInput = {
    where: Prisma.UserWhereUniqueInput;
    create: Prisma.XOR<Prisma.UserCreateWithoutBoilerHistoriesInput, Prisma.UserUncheckedCreateWithoutBoilerHistoriesInput>;
};
export type UserUpsertWithoutBoilerHistoriesInput = {
    update: Prisma.XOR<Prisma.UserUpdateWithoutBoilerHistoriesInput, Prisma.UserUncheckedUpdateWithoutBoilerHistoriesInput>;
    create: Prisma.XOR<Prisma.UserCreateWithoutBoilerHistoriesInput, Prisma.UserUncheckedCreateWithoutBoilerHistoriesInput>;
    where?: Prisma.UserWhereInput;
};
export type UserUpdateToOneWithWhereWithoutBoilerHistoriesInput = {
    where?: Prisma.UserWhereInput;
    data: Prisma.XOR<Prisma.UserUpdateWithoutBoilerHistoriesInput, Prisma.UserUncheckedUpdateWithoutBoilerHistoriesInput>;
};
export type UserUpdateWithoutBoilerHistoriesInput = {
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    homeProfiles?: Prisma.HomeProfileUpdateManyWithoutUserNestedInput;
    thermostatDevices?: Prisma.ThermostatDeviceUpdateManyWithoutUserNestedInput;
    recommendations?: Prisma.RecommendationUpdateManyWithoutUserNestedInput;
};
export type UserUncheckedUpdateWithoutBoilerHistoriesInput = {
    id?: Prisma.IntFieldUpdateOperationsInput | number;
    email?: Prisma.StringFieldUpdateOperationsInput | string;
    passwordHash?: Prisma.StringFieldUpdateOperationsInput | string;
    name?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    homeLocation?: Prisma.NullableStringFieldUpdateOperationsInput | string | null;
    createdAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    updatedAt?: Prisma.DateTimeFieldUpdateOperationsInput | Date | string;
    homeProfiles?: Prisma.HomeProfileUncheckedUpdateManyWithoutUserNestedInput;
    thermostatDevices?: Prisma.ThermostatDeviceUncheckedUpdateManyWithoutUserNestedInput;
    recommendations?: Prisma.RecommendationUncheckedUpdateManyWithoutUserNestedInput;
};
export type UserCountOutputType = {
    homeProfiles: number;
    thermostatDevices: number;
    recommendations: number;
    boilerHistories: number;
};
export type UserCountOutputTypeSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    homeProfiles?: boolean | UserCountOutputTypeCountHomeProfilesArgs;
    thermostatDevices?: boolean | UserCountOutputTypeCountThermostatDevicesArgs;
    recommendations?: boolean | UserCountOutputTypeCountRecommendationsArgs;
    boilerHistories?: boolean | UserCountOutputTypeCountBoilerHistoriesArgs;
};
export type UserCountOutputTypeDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.UserCountOutputTypeSelect<ExtArgs> | null;
};
export type UserCountOutputTypeCountHomeProfilesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.HomeProfileWhereInput;
};
export type UserCountOutputTypeCountThermostatDevicesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.ThermostatDeviceWhereInput;
};
export type UserCountOutputTypeCountRecommendationsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.RecommendationWhereInput;
};
export type UserCountOutputTypeCountBoilerHistoriesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.BoilerHistoryWhereInput;
};
export type UserSelect<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetSelect<{
    id?: boolean;
    email?: boolean;
    passwordHash?: boolean;
    name?: boolean;
    homeLocation?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
    homeProfiles?: boolean | Prisma.User$homeProfilesArgs<ExtArgs>;
    thermostatDevices?: boolean | Prisma.User$thermostatDevicesArgs<ExtArgs>;
    recommendations?: boolean | Prisma.User$recommendationsArgs<ExtArgs>;
    boilerHistories?: boolean | Prisma.User$boilerHistoriesArgs<ExtArgs>;
    _count?: boolean | Prisma.UserCountOutputTypeDefaultArgs<ExtArgs>;
}, ExtArgs["result"]["user"]>;
export type UserSelectScalar = {
    id?: boolean;
    email?: boolean;
    passwordHash?: boolean;
    name?: boolean;
    homeLocation?: boolean;
    createdAt?: boolean;
    updatedAt?: boolean;
};
export type UserOmit<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = runtime.Types.Extensions.GetOmit<"id" | "email" | "passwordHash" | "name" | "homeLocation" | "createdAt" | "updatedAt", ExtArgs["result"]["user"]>;
export type UserInclude<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    homeProfiles?: boolean | Prisma.User$homeProfilesArgs<ExtArgs>;
    thermostatDevices?: boolean | Prisma.User$thermostatDevicesArgs<ExtArgs>;
    recommendations?: boolean | Prisma.User$recommendationsArgs<ExtArgs>;
    boilerHistories?: boolean | Prisma.User$boilerHistoriesArgs<ExtArgs>;
    _count?: boolean | Prisma.UserCountOutputTypeDefaultArgs<ExtArgs>;
};
export type $UserPayload<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    name: "User";
    objects: {
        homeProfiles: Prisma.$HomeProfilePayload<ExtArgs>[];
        thermostatDevices: Prisma.$ThermostatDevicePayload<ExtArgs>[];
        recommendations: Prisma.$RecommendationPayload<ExtArgs>[];
        boilerHistories: Prisma.$BoilerHistoryPayload<ExtArgs>[];
    };
    scalars: runtime.Types.Extensions.GetPayloadResult<{
        id: number;
        email: string;
        passwordHash: string;
        name: string | null;
        homeLocation: string | null;
        createdAt: Date;
        updatedAt: Date;
    }, ExtArgs["result"]["user"]>;
    composites: {};
};
export type UserGetPayload<S extends boolean | null | undefined | UserDefaultArgs> = runtime.Types.Result.GetResult<Prisma.$UserPayload, S>;
export type UserCountArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = Omit<UserFindManyArgs, 'select' | 'include' | 'distinct' | 'omit'> & {
    select?: UserCountAggregateInputType | true;
};
export interface UserDelegate<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> {
    [K: symbol]: {
        types: Prisma.TypeMap<ExtArgs>['model']['User'];
        meta: {
            name: 'User';
        };
    };
    findUnique<T extends UserFindUniqueArgs>(args: Prisma.SelectSubset<T, UserFindUniqueArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUnique", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findUniqueOrThrow<T extends UserFindUniqueOrThrowArgs>(args: Prisma.SelectSubset<T, UserFindUniqueOrThrowArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findUniqueOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findFirst<T extends UserFindFirstArgs>(args?: Prisma.SelectSubset<T, UserFindFirstArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirst", GlobalOmitOptions> | null, null, ExtArgs, GlobalOmitOptions>;
    findFirstOrThrow<T extends UserFindFirstOrThrowArgs>(args?: Prisma.SelectSubset<T, UserFindFirstOrThrowArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findFirstOrThrow", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    findMany<T extends UserFindManyArgs>(args?: Prisma.SelectSubset<T, UserFindManyArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "findMany", GlobalOmitOptions>>;
    create<T extends UserCreateArgs>(args: Prisma.SelectSubset<T, UserCreateArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "create", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    createMany<T extends UserCreateManyArgs>(args?: Prisma.SelectSubset<T, UserCreateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    delete<T extends UserDeleteArgs>(args: Prisma.SelectSubset<T, UserDeleteArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "delete", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    update<T extends UserUpdateArgs>(args: Prisma.SelectSubset<T, UserUpdateArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "update", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    deleteMany<T extends UserDeleteManyArgs>(args?: Prisma.SelectSubset<T, UserDeleteManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    updateMany<T extends UserUpdateManyArgs>(args: Prisma.SelectSubset<T, UserUpdateManyArgs<ExtArgs>>): Prisma.PrismaPromise<Prisma.BatchPayload>;
    upsert<T extends UserUpsertArgs>(args: Prisma.SelectSubset<T, UserUpsertArgs<ExtArgs>>): Prisma.Prisma__UserClient<runtime.Types.Result.GetResult<Prisma.$UserPayload<ExtArgs>, T, "upsert", GlobalOmitOptions>, never, ExtArgs, GlobalOmitOptions>;
    count<T extends UserCountArgs>(args?: Prisma.Subset<T, UserCountArgs>): Prisma.PrismaPromise<T extends runtime.Types.Utils.Record<'select', any> ? T['select'] extends true ? number : Prisma.GetScalarType<T['select'], UserCountAggregateOutputType> : number>;
    aggregate<T extends UserAggregateArgs>(args: Prisma.Subset<T, UserAggregateArgs>): Prisma.PrismaPromise<GetUserAggregateType<T>>;
    groupBy<T extends UserGroupByArgs, HasSelectOrTake extends Prisma.Or<Prisma.Extends<'skip', Prisma.Keys<T>>, Prisma.Extends<'take', Prisma.Keys<T>>>, OrderByArg extends Prisma.True extends HasSelectOrTake ? {
        orderBy: UserGroupByArgs['orderBy'];
    } : {
        orderBy?: UserGroupByArgs['orderBy'];
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
    }[OrderFields]>(args: Prisma.SubsetIntersection<T, UserGroupByArgs, OrderByArg> & InputErrors): {} extends InputErrors ? GetUserGroupByPayload<T> : Prisma.PrismaPromise<InputErrors>;
    readonly fields: UserFieldRefs;
}
export interface Prisma__UserClient<T, Null = never, ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> extends Prisma.PrismaPromise<T> {
    readonly [Symbol.toStringTag]: "PrismaPromise";
    homeProfiles<T extends Prisma.User$homeProfilesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.User$homeProfilesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$HomeProfilePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    thermostatDevices<T extends Prisma.User$thermostatDevicesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.User$thermostatDevicesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$ThermostatDevicePayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    recommendations<T extends Prisma.User$recommendationsArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.User$recommendationsArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$RecommendationPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    boilerHistories<T extends Prisma.User$boilerHistoriesArgs<ExtArgs> = {}>(args?: Prisma.Subset<T, Prisma.User$boilerHistoriesArgs<ExtArgs>>): Prisma.PrismaPromise<runtime.Types.Result.GetResult<Prisma.$BoilerHistoryPayload<ExtArgs>, T, "findMany", GlobalOmitOptions> | Null>;
    then<TResult1 = T, TResult2 = never>(onfulfilled?: ((value: T) => TResult1 | PromiseLike<TResult1>) | undefined | null, onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | undefined | null): runtime.Types.Utils.JsPromise<TResult1 | TResult2>;
    catch<TResult = never>(onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | undefined | null): runtime.Types.Utils.JsPromise<T | TResult>;
    finally(onfinally?: (() => void) | undefined | null): runtime.Types.Utils.JsPromise<T>;
}
export interface UserFieldRefs {
    readonly id: Prisma.FieldRef<"User", 'Int'>;
    readonly email: Prisma.FieldRef<"User", 'String'>;
    readonly passwordHash: Prisma.FieldRef<"User", 'String'>;
    readonly name: Prisma.FieldRef<"User", 'String'>;
    readonly homeLocation: Prisma.FieldRef<"User", 'String'>;
    readonly createdAt: Prisma.FieldRef<"User", 'DateTime'>;
    readonly updatedAt: Prisma.FieldRef<"User", 'DateTime'>;
}
export type UserFindUniqueArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.UserSelect<ExtArgs> | null;
    omit?: Prisma.UserOmit<ExtArgs> | null;
    include?: Prisma.UserInclude<ExtArgs> | null;
    where: Prisma.UserWhereUniqueInput;
};
export type UserFindUniqueOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.UserSelect<ExtArgs> | null;
    omit?: Prisma.UserOmit<ExtArgs> | null;
    include?: Prisma.UserInclude<ExtArgs> | null;
    where: Prisma.UserWhereUniqueInput;
};
export type UserFindFirstArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.UserSelect<ExtArgs> | null;
    omit?: Prisma.UserOmit<ExtArgs> | null;
    include?: Prisma.UserInclude<ExtArgs> | null;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[];
    cursor?: Prisma.UserWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.UserScalarFieldEnum | Prisma.UserScalarFieldEnum[];
};
export type UserFindFirstOrThrowArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.UserSelect<ExtArgs> | null;
    omit?: Prisma.UserOmit<ExtArgs> | null;
    include?: Prisma.UserInclude<ExtArgs> | null;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[];
    cursor?: Prisma.UserWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.UserScalarFieldEnum | Prisma.UserScalarFieldEnum[];
};
export type UserFindManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.UserSelect<ExtArgs> | null;
    omit?: Prisma.UserOmit<ExtArgs> | null;
    include?: Prisma.UserInclude<ExtArgs> | null;
    where?: Prisma.UserWhereInput;
    orderBy?: Prisma.UserOrderByWithRelationInput | Prisma.UserOrderByWithRelationInput[];
    cursor?: Prisma.UserWhereUniqueInput;
    take?: number;
    skip?: number;
    distinct?: Prisma.UserScalarFieldEnum | Prisma.UserScalarFieldEnum[];
};
export type UserCreateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.UserSelect<ExtArgs> | null;
    omit?: Prisma.UserOmit<ExtArgs> | null;
    include?: Prisma.UserInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.UserCreateInput, Prisma.UserUncheckedCreateInput>;
};
export type UserCreateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.UserCreateManyInput | Prisma.UserCreateManyInput[];
    skipDuplicates?: boolean;
};
export type UserUpdateArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.UserSelect<ExtArgs> | null;
    omit?: Prisma.UserOmit<ExtArgs> | null;
    include?: Prisma.UserInclude<ExtArgs> | null;
    data: Prisma.XOR<Prisma.UserUpdateInput, Prisma.UserUncheckedUpdateInput>;
    where: Prisma.UserWhereUniqueInput;
};
export type UserUpdateManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    data: Prisma.XOR<Prisma.UserUpdateManyMutationInput, Prisma.UserUncheckedUpdateManyInput>;
    where?: Prisma.UserWhereInput;
    limit?: number;
};
export type UserUpsertArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.UserSelect<ExtArgs> | null;
    omit?: Prisma.UserOmit<ExtArgs> | null;
    include?: Prisma.UserInclude<ExtArgs> | null;
    where: Prisma.UserWhereUniqueInput;
    create: Prisma.XOR<Prisma.UserCreateInput, Prisma.UserUncheckedCreateInput>;
    update: Prisma.XOR<Prisma.UserUpdateInput, Prisma.UserUncheckedUpdateInput>;
};
export type UserDeleteArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.UserSelect<ExtArgs> | null;
    omit?: Prisma.UserOmit<ExtArgs> | null;
    include?: Prisma.UserInclude<ExtArgs> | null;
    where: Prisma.UserWhereUniqueInput;
};
export type UserDeleteManyArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    where?: Prisma.UserWhereInput;
    limit?: number;
};
export type User$homeProfilesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type User$thermostatDevicesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type User$recommendationsArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type User$boilerHistoriesArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
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
export type UserDefaultArgs<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs> = {
    select?: Prisma.UserSelect<ExtArgs> | null;
    omit?: Prisma.UserOmit<ExtArgs> | null;
    include?: Prisma.UserInclude<ExtArgs> | null;
};
export {};
