import * as runtime from "@prisma/client/runtime/client";
import type * as Prisma from "../models.js";
import { type PrismaClient } from "./class.js";
export type * from '../models.js';
export type DMMF = typeof runtime.DMMF;
export type PrismaPromise<T> = runtime.Types.Public.PrismaPromise<T>;
export declare const PrismaClientKnownRequestError: typeof runtime.PrismaClientKnownRequestError;
export type PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
export declare const PrismaClientUnknownRequestError: typeof runtime.PrismaClientUnknownRequestError;
export type PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
export declare const PrismaClientRustPanicError: typeof runtime.PrismaClientRustPanicError;
export type PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
export declare const PrismaClientInitializationError: typeof runtime.PrismaClientInitializationError;
export type PrismaClientInitializationError = runtime.PrismaClientInitializationError;
export declare const PrismaClientValidationError: typeof runtime.PrismaClientValidationError;
export type PrismaClientValidationError = runtime.PrismaClientValidationError;
export declare const sql: typeof runtime.sqltag;
export declare const empty: runtime.Sql;
export declare const join: typeof runtime.join;
export declare const raw: typeof runtime.raw;
export declare const Sql: typeof runtime.Sql;
export type Sql = runtime.Sql;
export declare const Decimal: typeof runtime.Decimal;
export type Decimal = runtime.Decimal;
export type DecimalJsLike = runtime.DecimalJsLike;
export type Extension = runtime.Types.Extensions.UserArgs;
export declare const getExtensionContext: typeof runtime.Extensions.getExtensionContext;
export type Args<T, F extends runtime.Operation> = runtime.Types.Public.Args<T, F>;
export type Payload<T, F extends runtime.Operation = never> = runtime.Types.Public.Payload<T, F>;
export type Result<T, A, F extends runtime.Operation> = runtime.Types.Public.Result<T, A, F>;
export type Exact<A, W> = runtime.Types.Public.Exact<A, W>;
export type PrismaVersion = {
    client: string;
    engine: string;
};
export declare const prismaVersion: PrismaVersion;
export type Bytes = runtime.Bytes;
export type JsonObject = runtime.JsonObject;
export type JsonArray = runtime.JsonArray;
export type JsonValue = runtime.JsonValue;
export type InputJsonObject = runtime.InputJsonObject;
export type InputJsonArray = runtime.InputJsonArray;
export type InputJsonValue = runtime.InputJsonValue;
export declare const NullTypes: {
    DbNull: (new (secret: never) => typeof runtime.DbNull);
    JsonNull: (new (secret: never) => typeof runtime.JsonNull);
    AnyNull: (new (secret: never) => typeof runtime.AnyNull);
};
export declare const DbNull: runtime.DbNullClass;
export declare const JsonNull: runtime.JsonNullClass;
export declare const AnyNull: runtime.AnyNullClass;
type SelectAndInclude = {
    select: any;
    include: any;
};
type SelectAndOmit = {
    select: any;
    omit: any;
};
type Prisma__Pick<T, K extends keyof T> = {
    [P in K]: T[P];
};
export type Enumerable<T> = T | Array<T>;
export type Subset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
};
export type SelectSubset<T, U> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
} & (T extends SelectAndInclude ? 'Please either choose `select` or `include`.' : T extends SelectAndOmit ? 'Please either choose `select` or `omit`.' : {});
export type SubsetIntersection<T, U, K> = {
    [key in keyof T]: key extends keyof U ? T[key] : never;
} & K;
type Without<T, U> = {
    [P in Exclude<keyof T, keyof U>]?: never;
};
export type XOR<T, U> = T extends object ? U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : U : T;
type IsObject<T extends any> = T extends Array<any> ? False : T extends Date ? False : T extends Uint8Array ? False : T extends BigInt ? False : T extends object ? True : False;
export type UnEnumerate<T extends unknown> = T extends Array<infer U> ? U : T;
type __Either<O extends object, K extends Key> = Omit<O, K> & {
    [P in K]: Prisma__Pick<O, P & keyof O>;
}[K];
type EitherStrict<O extends object, K extends Key> = Strict<__Either<O, K>>;
type EitherLoose<O extends object, K extends Key> = ComputeRaw<__Either<O, K>>;
type _Either<O extends object, K extends Key, strict extends Boolean> = {
    1: EitherStrict<O, K>;
    0: EitherLoose<O, K>;
}[strict];
export type Either<O extends object, K extends Key, strict extends Boolean = 1> = O extends unknown ? _Either<O, K, strict> : never;
export type Union = any;
export type PatchUndefined<O extends object, O1 extends object> = {
    [K in keyof O]: O[K] extends undefined ? At<O1, K> : O[K];
} & {};
export type IntersectOf<U extends Union> = (U extends unknown ? (k: U) => void : never) extends (k: infer I) => void ? I : never;
export type Overwrite<O extends object, O1 extends object> = {
    [K in keyof O]: K extends keyof O1 ? O1[K] : O[K];
} & {};
type _Merge<U extends object> = IntersectOf<Overwrite<U, {
    [K in keyof U]-?: At<U, K>;
}>>;
type Key = string | number | symbol;
type AtStrict<O extends object, K extends Key> = O[K & keyof O];
type AtLoose<O extends object, K extends Key> = O extends unknown ? AtStrict<O, K> : never;
export type At<O extends object, K extends Key, strict extends Boolean = 1> = {
    1: AtStrict<O, K>;
    0: AtLoose<O, K>;
}[strict];
export type ComputeRaw<A extends any> = A extends Function ? A : {
    [K in keyof A]: A[K];
} & {};
export type OptionalFlat<O> = {
    [K in keyof O]?: O[K];
} & {};
type _Record<K extends keyof any, T> = {
    [P in K]: T;
};
type NoExpand<T> = T extends unknown ? T : never;
export type AtLeast<O extends object, K extends string> = NoExpand<O extends unknown ? (K extends keyof O ? {
    [P in K]: O[P];
} & O : O) | {
    [P in keyof O as P extends K ? P : never]-?: O[P];
} & O : never>;
type _Strict<U, _U = U> = U extends unknown ? U & OptionalFlat<_Record<Exclude<Keys<_U>, keyof U>, never>> : never;
export type Strict<U extends object> = ComputeRaw<_Strict<U>>;
export type Merge<U extends object> = ComputeRaw<_Merge<Strict<U>>>;
export type Boolean = True | False;
export type True = 1;
export type False = 0;
export type Not<B extends Boolean> = {
    0: 1;
    1: 0;
}[B];
export type Extends<A1 extends any, A2 extends any> = [A1] extends [never] ? 0 : A1 extends A2 ? 1 : 0;
export type Has<U extends Union, U1 extends Union> = Not<Extends<Exclude<U1, U>, U1>>;
export type Or<B1 extends Boolean, B2 extends Boolean> = {
    0: {
        0: 0;
        1: 1;
    };
    1: {
        0: 1;
        1: 1;
    };
}[B1][B2];
export type Keys<U extends Union> = U extends unknown ? keyof U : never;
export type GetScalarType<T, O> = O extends object ? {
    [P in keyof T]: P extends keyof O ? O[P] : never;
} : never;
type FieldPaths<T, U = Omit<T, '_avg' | '_sum' | '_count' | '_min' | '_max'>> = IsObject<T> extends True ? U : T;
export type GetHavingFields<T> = {
    [K in keyof T]: Or<Or<Extends<'OR', K>, Extends<'AND', K>>, Extends<'NOT', K>> extends True ? T[K] extends infer TK ? GetHavingFields<UnEnumerate<TK> extends object ? Merge<UnEnumerate<TK>> : never> : never : {} extends FieldPaths<T[K]> ? never : K;
}[keyof T];
type _TupleToUnion<T> = T extends (infer E)[] ? E : never;
type TupleToUnion<K extends readonly any[]> = _TupleToUnion<K>;
export type MaybeTupleToUnion<T> = T extends any[] ? TupleToUnion<T> : T;
export type PickEnumerable<T, K extends Enumerable<keyof T> | keyof T> = Prisma__Pick<T, MaybeTupleToUnion<K>>;
export type ExcludeUnderscoreKeys<T extends string> = T extends `_${string}` ? never : T;
export type FieldRef<Model, FieldType> = runtime.FieldRef<Model, FieldType>;
type FieldRefInputType<Model, FieldType> = Model extends never ? never : FieldRef<Model, FieldType>;
export declare const ModelName: {
    readonly User: "User";
    readonly HomeProfile: "HomeProfile";
    readonly ThermostatDevice: "ThermostatDevice";
    readonly HeatingEvent: "HeatingEvent";
    readonly Recommendation: "Recommendation";
    readonly WeatherCache: "WeatherCache";
    readonly BoilerHistory: "BoilerHistory";
    readonly HeatingIntervalLearning: "HeatingIntervalLearning";
    readonly TuyaToken: "TuyaToken";
};
export type ModelName = (typeof ModelName)[keyof typeof ModelName];
export interface TypeMapCb<GlobalOmitOptions = {}> extends runtime.Types.Utils.Fn<{
    extArgs: runtime.Types.Extensions.InternalArgs;
}, runtime.Types.Utils.Record<string, any>> {
    returns: TypeMap<this['params']['extArgs'], GlobalOmitOptions>;
}
export type TypeMap<ExtArgs extends runtime.Types.Extensions.InternalArgs = runtime.Types.Extensions.DefaultArgs, GlobalOmitOptions = {}> = {
    globalOmitOptions: {
        omit: GlobalOmitOptions;
    };
    meta: {
        modelProps: "user" | "homeProfile" | "thermostatDevice" | "heatingEvent" | "recommendation" | "weatherCache" | "boilerHistory" | "heatingIntervalLearning" | "tuyaToken";
        txIsolationLevel: TransactionIsolationLevel;
    };
    model: {
        User: {
            payload: Prisma.$UserPayload<ExtArgs>;
            fields: Prisma.UserFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.UserFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$UserPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.UserFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$UserPayload>;
                };
                findFirst: {
                    args: Prisma.UserFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$UserPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.UserFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$UserPayload>;
                };
                findMany: {
                    args: Prisma.UserFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$UserPayload>[];
                };
                create: {
                    args: Prisma.UserCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$UserPayload>;
                };
                createMany: {
                    args: Prisma.UserCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.UserDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$UserPayload>;
                };
                update: {
                    args: Prisma.UserUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$UserPayload>;
                };
                deleteMany: {
                    args: Prisma.UserDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.UserUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.UserUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$UserPayload>;
                };
                aggregate: {
                    args: Prisma.UserAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateUser>;
                };
                groupBy: {
                    args: Prisma.UserGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.UserGroupByOutputType>[];
                };
                count: {
                    args: Prisma.UserCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.UserCountAggregateOutputType> | number;
                };
            };
        };
        HomeProfile: {
            payload: Prisma.$HomeProfilePayload<ExtArgs>;
            fields: Prisma.HomeProfileFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.HomeProfileFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HomeProfilePayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.HomeProfileFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HomeProfilePayload>;
                };
                findFirst: {
                    args: Prisma.HomeProfileFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HomeProfilePayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.HomeProfileFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HomeProfilePayload>;
                };
                findMany: {
                    args: Prisma.HomeProfileFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HomeProfilePayload>[];
                };
                create: {
                    args: Prisma.HomeProfileCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HomeProfilePayload>;
                };
                createMany: {
                    args: Prisma.HomeProfileCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.HomeProfileDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HomeProfilePayload>;
                };
                update: {
                    args: Prisma.HomeProfileUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HomeProfilePayload>;
                };
                deleteMany: {
                    args: Prisma.HomeProfileDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.HomeProfileUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.HomeProfileUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HomeProfilePayload>;
                };
                aggregate: {
                    args: Prisma.HomeProfileAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateHomeProfile>;
                };
                groupBy: {
                    args: Prisma.HomeProfileGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.HomeProfileGroupByOutputType>[];
                };
                count: {
                    args: Prisma.HomeProfileCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.HomeProfileCountAggregateOutputType> | number;
                };
            };
        };
        ThermostatDevice: {
            payload: Prisma.$ThermostatDevicePayload<ExtArgs>;
            fields: Prisma.ThermostatDeviceFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.ThermostatDeviceFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$ThermostatDevicePayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.ThermostatDeviceFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$ThermostatDevicePayload>;
                };
                findFirst: {
                    args: Prisma.ThermostatDeviceFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$ThermostatDevicePayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.ThermostatDeviceFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$ThermostatDevicePayload>;
                };
                findMany: {
                    args: Prisma.ThermostatDeviceFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$ThermostatDevicePayload>[];
                };
                create: {
                    args: Prisma.ThermostatDeviceCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$ThermostatDevicePayload>;
                };
                createMany: {
                    args: Prisma.ThermostatDeviceCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.ThermostatDeviceDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$ThermostatDevicePayload>;
                };
                update: {
                    args: Prisma.ThermostatDeviceUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$ThermostatDevicePayload>;
                };
                deleteMany: {
                    args: Prisma.ThermostatDeviceDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.ThermostatDeviceUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.ThermostatDeviceUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$ThermostatDevicePayload>;
                };
                aggregate: {
                    args: Prisma.ThermostatDeviceAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateThermostatDevice>;
                };
                groupBy: {
                    args: Prisma.ThermostatDeviceGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.ThermostatDeviceGroupByOutputType>[];
                };
                count: {
                    args: Prisma.ThermostatDeviceCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.ThermostatDeviceCountAggregateOutputType> | number;
                };
            };
        };
        HeatingEvent: {
            payload: Prisma.$HeatingEventPayload<ExtArgs>;
            fields: Prisma.HeatingEventFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.HeatingEventFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingEventPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.HeatingEventFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingEventPayload>;
                };
                findFirst: {
                    args: Prisma.HeatingEventFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingEventPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.HeatingEventFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingEventPayload>;
                };
                findMany: {
                    args: Prisma.HeatingEventFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingEventPayload>[];
                };
                create: {
                    args: Prisma.HeatingEventCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingEventPayload>;
                };
                createMany: {
                    args: Prisma.HeatingEventCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.HeatingEventDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingEventPayload>;
                };
                update: {
                    args: Prisma.HeatingEventUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingEventPayload>;
                };
                deleteMany: {
                    args: Prisma.HeatingEventDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.HeatingEventUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.HeatingEventUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingEventPayload>;
                };
                aggregate: {
                    args: Prisma.HeatingEventAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateHeatingEvent>;
                };
                groupBy: {
                    args: Prisma.HeatingEventGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.HeatingEventGroupByOutputType>[];
                };
                count: {
                    args: Prisma.HeatingEventCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.HeatingEventCountAggregateOutputType> | number;
                };
            };
        };
        Recommendation: {
            payload: Prisma.$RecommendationPayload<ExtArgs>;
            fields: Prisma.RecommendationFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.RecommendationFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$RecommendationPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.RecommendationFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$RecommendationPayload>;
                };
                findFirst: {
                    args: Prisma.RecommendationFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$RecommendationPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.RecommendationFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$RecommendationPayload>;
                };
                findMany: {
                    args: Prisma.RecommendationFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$RecommendationPayload>[];
                };
                create: {
                    args: Prisma.RecommendationCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$RecommendationPayload>;
                };
                createMany: {
                    args: Prisma.RecommendationCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.RecommendationDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$RecommendationPayload>;
                };
                update: {
                    args: Prisma.RecommendationUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$RecommendationPayload>;
                };
                deleteMany: {
                    args: Prisma.RecommendationDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.RecommendationUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.RecommendationUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$RecommendationPayload>;
                };
                aggregate: {
                    args: Prisma.RecommendationAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateRecommendation>;
                };
                groupBy: {
                    args: Prisma.RecommendationGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.RecommendationGroupByOutputType>[];
                };
                count: {
                    args: Prisma.RecommendationCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.RecommendationCountAggregateOutputType> | number;
                };
            };
        };
        WeatherCache: {
            payload: Prisma.$WeatherCachePayload<ExtArgs>;
            fields: Prisma.WeatherCacheFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.WeatherCacheFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WeatherCachePayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.WeatherCacheFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WeatherCachePayload>;
                };
                findFirst: {
                    args: Prisma.WeatherCacheFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WeatherCachePayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.WeatherCacheFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WeatherCachePayload>;
                };
                findMany: {
                    args: Prisma.WeatherCacheFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WeatherCachePayload>[];
                };
                create: {
                    args: Prisma.WeatherCacheCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WeatherCachePayload>;
                };
                createMany: {
                    args: Prisma.WeatherCacheCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.WeatherCacheDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WeatherCachePayload>;
                };
                update: {
                    args: Prisma.WeatherCacheUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WeatherCachePayload>;
                };
                deleteMany: {
                    args: Prisma.WeatherCacheDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.WeatherCacheUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.WeatherCacheUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$WeatherCachePayload>;
                };
                aggregate: {
                    args: Prisma.WeatherCacheAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateWeatherCache>;
                };
                groupBy: {
                    args: Prisma.WeatherCacheGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.WeatherCacheGroupByOutputType>[];
                };
                count: {
                    args: Prisma.WeatherCacheCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.WeatherCacheCountAggregateOutputType> | number;
                };
            };
        };
        BoilerHistory: {
            payload: Prisma.$BoilerHistoryPayload<ExtArgs>;
            fields: Prisma.BoilerHistoryFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.BoilerHistoryFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BoilerHistoryPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.BoilerHistoryFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BoilerHistoryPayload>;
                };
                findFirst: {
                    args: Prisma.BoilerHistoryFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BoilerHistoryPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.BoilerHistoryFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BoilerHistoryPayload>;
                };
                findMany: {
                    args: Prisma.BoilerHistoryFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BoilerHistoryPayload>[];
                };
                create: {
                    args: Prisma.BoilerHistoryCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BoilerHistoryPayload>;
                };
                createMany: {
                    args: Prisma.BoilerHistoryCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.BoilerHistoryDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BoilerHistoryPayload>;
                };
                update: {
                    args: Prisma.BoilerHistoryUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BoilerHistoryPayload>;
                };
                deleteMany: {
                    args: Prisma.BoilerHistoryDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.BoilerHistoryUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.BoilerHistoryUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$BoilerHistoryPayload>;
                };
                aggregate: {
                    args: Prisma.BoilerHistoryAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateBoilerHistory>;
                };
                groupBy: {
                    args: Prisma.BoilerHistoryGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.BoilerHistoryGroupByOutputType>[];
                };
                count: {
                    args: Prisma.BoilerHistoryCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.BoilerHistoryCountAggregateOutputType> | number;
                };
            };
        };
        HeatingIntervalLearning: {
            payload: Prisma.$HeatingIntervalLearningPayload<ExtArgs>;
            fields: Prisma.HeatingIntervalLearningFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.HeatingIntervalLearningFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingIntervalLearningPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.HeatingIntervalLearningFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingIntervalLearningPayload>;
                };
                findFirst: {
                    args: Prisma.HeatingIntervalLearningFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingIntervalLearningPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.HeatingIntervalLearningFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingIntervalLearningPayload>;
                };
                findMany: {
                    args: Prisma.HeatingIntervalLearningFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingIntervalLearningPayload>[];
                };
                create: {
                    args: Prisma.HeatingIntervalLearningCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingIntervalLearningPayload>;
                };
                createMany: {
                    args: Prisma.HeatingIntervalLearningCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.HeatingIntervalLearningDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingIntervalLearningPayload>;
                };
                update: {
                    args: Prisma.HeatingIntervalLearningUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingIntervalLearningPayload>;
                };
                deleteMany: {
                    args: Prisma.HeatingIntervalLearningDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.HeatingIntervalLearningUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.HeatingIntervalLearningUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$HeatingIntervalLearningPayload>;
                };
                aggregate: {
                    args: Prisma.HeatingIntervalLearningAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateHeatingIntervalLearning>;
                };
                groupBy: {
                    args: Prisma.HeatingIntervalLearningGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.HeatingIntervalLearningGroupByOutputType>[];
                };
                count: {
                    args: Prisma.HeatingIntervalLearningCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.HeatingIntervalLearningCountAggregateOutputType> | number;
                };
            };
        };
        TuyaToken: {
            payload: Prisma.$TuyaTokenPayload<ExtArgs>;
            fields: Prisma.TuyaTokenFieldRefs;
            operations: {
                findUnique: {
                    args: Prisma.TuyaTokenFindUniqueArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TuyaTokenPayload> | null;
                };
                findUniqueOrThrow: {
                    args: Prisma.TuyaTokenFindUniqueOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TuyaTokenPayload>;
                };
                findFirst: {
                    args: Prisma.TuyaTokenFindFirstArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TuyaTokenPayload> | null;
                };
                findFirstOrThrow: {
                    args: Prisma.TuyaTokenFindFirstOrThrowArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TuyaTokenPayload>;
                };
                findMany: {
                    args: Prisma.TuyaTokenFindManyArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TuyaTokenPayload>[];
                };
                create: {
                    args: Prisma.TuyaTokenCreateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TuyaTokenPayload>;
                };
                createMany: {
                    args: Prisma.TuyaTokenCreateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                delete: {
                    args: Prisma.TuyaTokenDeleteArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TuyaTokenPayload>;
                };
                update: {
                    args: Prisma.TuyaTokenUpdateArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TuyaTokenPayload>;
                };
                deleteMany: {
                    args: Prisma.TuyaTokenDeleteManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                updateMany: {
                    args: Prisma.TuyaTokenUpdateManyArgs<ExtArgs>;
                    result: BatchPayload;
                };
                upsert: {
                    args: Prisma.TuyaTokenUpsertArgs<ExtArgs>;
                    result: runtime.Types.Utils.PayloadToResult<Prisma.$TuyaTokenPayload>;
                };
                aggregate: {
                    args: Prisma.TuyaTokenAggregateArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.AggregateTuyaToken>;
                };
                groupBy: {
                    args: Prisma.TuyaTokenGroupByArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TuyaTokenGroupByOutputType>[];
                };
                count: {
                    args: Prisma.TuyaTokenCountArgs<ExtArgs>;
                    result: runtime.Types.Utils.Optional<Prisma.TuyaTokenCountAggregateOutputType> | number;
                };
            };
        };
    };
} & {
    other: {
        payload: any;
        operations: {
            $executeRaw: {
                args: [query: TemplateStringsArray | Sql, ...values: any[]];
                result: any;
            };
            $executeRawUnsafe: {
                args: [query: string, ...values: any[]];
                result: any;
            };
            $queryRaw: {
                args: [query: TemplateStringsArray | Sql, ...values: any[]];
                result: any;
            };
            $queryRawUnsafe: {
                args: [query: string, ...values: any[]];
                result: any;
            };
        };
    };
};
export declare const TransactionIsolationLevel: {
    readonly ReadUncommitted: "ReadUncommitted";
    readonly ReadCommitted: "ReadCommitted";
    readonly RepeatableRead: "RepeatableRead";
    readonly Serializable: "Serializable";
};
export type TransactionIsolationLevel = (typeof TransactionIsolationLevel)[keyof typeof TransactionIsolationLevel];
export declare const UserScalarFieldEnum: {
    readonly id: "id";
    readonly email: "email";
    readonly passwordHash: "passwordHash";
    readonly name: "name";
    readonly homeLocation: "homeLocation";
    readonly createdAt: "createdAt";
    readonly updatedAt: "updatedAt";
};
export type UserScalarFieldEnum = (typeof UserScalarFieldEnum)[keyof typeof UserScalarFieldEnum];
export declare const HomeProfileScalarFieldEnum: {
    readonly id: "id";
    readonly userId: "userId";
    readonly floorArea: "floorArea";
    readonly ceilingHeight: "ceilingHeight";
    readonly insulationType: "insulationType";
    readonly insulationThickness: "insulationThickness";
    readonly windowType: "windowType";
    readonly heatingType: "heatingType";
    readonly constructionYear: "constructionYear";
    readonly learningOffset: "learningOffset";
    readonly learningConfidence: "learningConfidence";
    readonly createdAt: "createdAt";
    readonly updatedAt: "updatedAt";
};
export type HomeProfileScalarFieldEnum = (typeof HomeProfileScalarFieldEnum)[keyof typeof HomeProfileScalarFieldEnum];
export declare const ThermostatDeviceScalarFieldEnum: {
    readonly id: "id";
    readonly userId: "userId";
    readonly homeProfileId: "homeProfileId";
    readonly vendor: "vendor";
    readonly deviceId: "deviceId";
    readonly alias: "alias";
    readonly lastSeen: "lastSeen";
    readonly mode: "mode";
    readonly createdAt: "createdAt";
    readonly updatedAt: "updatedAt";
};
export type ThermostatDeviceScalarFieldEnum = (typeof ThermostatDeviceScalarFieldEnum)[keyof typeof ThermostatDeviceScalarFieldEnum];
export declare const HeatingEventScalarFieldEnum: {
    readonly id: "id";
    readonly deviceId: "deviceId";
    readonly timestampStart: "timestampStart";
    readonly timestampEnd: "timestampEnd";
    readonly currentTemp: "currentTemp";
    readonly targetTemp: "targetTemp";
    readonly hvacAction: "hvacAction";
    readonly source: "source";
    readonly createdAt: "createdAt";
};
export type HeatingEventScalarFieldEnum = (typeof HeatingEventScalarFieldEnum)[keyof typeof HeatingEventScalarFieldEnum];
export declare const RecommendationScalarFieldEnum: {
    readonly id: "id";
    readonly userId: "userId";
    readonly date: "date";
    readonly recommendedFlowTemp: "recommendedFlowTemp";
    readonly expectedHeatTimeMin: "expectedHeatTimeMin";
    readonly confidenceScore: "confidenceScore";
    readonly createdAt: "createdAt";
};
export type RecommendationScalarFieldEnum = (typeof RecommendationScalarFieldEnum)[keyof typeof RecommendationScalarFieldEnum];
export declare const WeatherCacheScalarFieldEnum: {
    readonly id: "id";
    readonly city: "city";
    readonly temperature: "temperature";
    readonly feelslike: "feelslike";
    readonly temp_min: "temp_min";
    readonly temp_max: "temp_max";
    readonly temp_avg: "temp_avg";
    readonly wind_kph: "wind_kph";
    readonly gust_kph: "gust_kph";
    readonly wind_dir: "wind_dir";
    readonly pressure_mb: "pressure_mb";
    readonly humidity: "humidity";
    readonly cloud: "cloud";
    readonly uv_index: "uv_index";
    readonly precipitation_mm: "precipitation_mm";
    readonly snow_cm: "snow_cm";
    readonly condition_text: "condition_text";
    readonly sunrise: "sunrise";
    readonly sunset: "sunset";
    readonly moonrise: "moonrise";
    readonly moonset: "moonset";
    readonly moon_phase: "moon_phase";
    readonly moon_illumination: "moon_illumination";
    readonly fetchedAt: "fetchedAt";
};
export type WeatherCacheScalarFieldEnum = (typeof WeatherCacheScalarFieldEnum)[keyof typeof WeatherCacheScalarFieldEnum];
export declare const BoilerHistoryScalarFieldEnum: {
    readonly id: "id";
    readonly userId: "userId";
    readonly externalTemp: "externalTemp";
    readonly suggestedTemp: "suggestedTemp";
    readonly actualTemp: "actualTemp";
    readonly heatingStart: "heatingStart";
    readonly heatingEnd: "heatingEnd";
    readonly createdAt: "createdAt";
};
export type BoilerHistoryScalarFieldEnum = (typeof BoilerHistoryScalarFieldEnum)[keyof typeof BoilerHistoryScalarFieldEnum];
export declare const HeatingIntervalLearningScalarFieldEnum: {
    readonly id: "id";
    readonly homeProfileId: "homeProfileId";
    readonly intervalKey: "intervalKey";
    readonly avgReachTimeMin: "avgReachTimeMin";
    readonly avgOvershoot: "avgOvershoot";
    readonly offset: "offset";
    readonly confidence: "confidence";
    readonly samples: "samples";
    readonly lastUpdated: "lastUpdated";
};
export type HeatingIntervalLearningScalarFieldEnum = (typeof HeatingIntervalLearningScalarFieldEnum)[keyof typeof HeatingIntervalLearningScalarFieldEnum];
export declare const TuyaTokenScalarFieldEnum: {
    readonly id: "id";
    readonly accessToken: "accessToken";
    readonly expiresAt: "expiresAt";
    readonly createdAt: "createdAt";
    readonly updatedAt: "updatedAt";
};
export type TuyaTokenScalarFieldEnum = (typeof TuyaTokenScalarFieldEnum)[keyof typeof TuyaTokenScalarFieldEnum];
export declare const SortOrder: {
    readonly asc: "asc";
    readonly desc: "desc";
};
export type SortOrder = (typeof SortOrder)[keyof typeof SortOrder];
export declare const NullsOrder: {
    readonly first: "first";
    readonly last: "last";
};
export type NullsOrder = (typeof NullsOrder)[keyof typeof NullsOrder];
export declare const UserOrderByRelevanceFieldEnum: {
    readonly email: "email";
    readonly passwordHash: "passwordHash";
    readonly name: "name";
    readonly homeLocation: "homeLocation";
};
export type UserOrderByRelevanceFieldEnum = (typeof UserOrderByRelevanceFieldEnum)[keyof typeof UserOrderByRelevanceFieldEnum];
export declare const HomeProfileOrderByRelevanceFieldEnum: {
    readonly insulationType: "insulationType";
    readonly windowType: "windowType";
    readonly heatingType: "heatingType";
};
export type HomeProfileOrderByRelevanceFieldEnum = (typeof HomeProfileOrderByRelevanceFieldEnum)[keyof typeof HomeProfileOrderByRelevanceFieldEnum];
export declare const ThermostatDeviceOrderByRelevanceFieldEnum: {
    readonly vendor: "vendor";
    readonly deviceId: "deviceId";
    readonly alias: "alias";
};
export type ThermostatDeviceOrderByRelevanceFieldEnum = (typeof ThermostatDeviceOrderByRelevanceFieldEnum)[keyof typeof ThermostatDeviceOrderByRelevanceFieldEnum];
export declare const HeatingEventOrderByRelevanceFieldEnum: {
    readonly hvacAction: "hvacAction";
    readonly source: "source";
};
export type HeatingEventOrderByRelevanceFieldEnum = (typeof HeatingEventOrderByRelevanceFieldEnum)[keyof typeof HeatingEventOrderByRelevanceFieldEnum];
export declare const WeatherCacheOrderByRelevanceFieldEnum: {
    readonly city: "city";
    readonly wind_dir: "wind_dir";
    readonly condition_text: "condition_text";
    readonly sunrise: "sunrise";
    readonly sunset: "sunset";
    readonly moonrise: "moonrise";
    readonly moonset: "moonset";
    readonly moon_phase: "moon_phase";
};
export type WeatherCacheOrderByRelevanceFieldEnum = (typeof WeatherCacheOrderByRelevanceFieldEnum)[keyof typeof WeatherCacheOrderByRelevanceFieldEnum];
export declare const HeatingIntervalLearningOrderByRelevanceFieldEnum: {
    readonly intervalKey: "intervalKey";
};
export type HeatingIntervalLearningOrderByRelevanceFieldEnum = (typeof HeatingIntervalLearningOrderByRelevanceFieldEnum)[keyof typeof HeatingIntervalLearningOrderByRelevanceFieldEnum];
export declare const TuyaTokenOrderByRelevanceFieldEnum: {
    readonly accessToken: "accessToken";
};
export type TuyaTokenOrderByRelevanceFieldEnum = (typeof TuyaTokenOrderByRelevanceFieldEnum)[keyof typeof TuyaTokenOrderByRelevanceFieldEnum];
export type IntFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Int'>;
export type StringFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'String'>;
export type DateTimeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'DateTime'>;
export type FloatFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'Float'>;
export type EnumThermostatModeFieldRefInput<$PrismaModel> = FieldRefInputType<$PrismaModel, 'ThermostatMode'>;
export type BatchPayload = {
    count: number;
};
export declare const defineExtension: runtime.Types.Extensions.ExtendsHook<"define", TypeMapCb, runtime.Types.Extensions.DefaultArgs>;
export type DefaultPrismaClient = PrismaClient;
export type ErrorFormat = 'pretty' | 'colorless' | 'minimal';
export type PrismaClientOptions = ({
    adapter: runtime.SqlDriverAdapterFactory;
    accelerateUrl?: never;
} | {
    accelerateUrl: string;
    adapter?: never;
}) & {
    errorFormat?: ErrorFormat;
    log?: (LogLevel | LogDefinition)[];
    transactionOptions?: {
        maxWait?: number;
        timeout?: number;
        isolationLevel?: TransactionIsolationLevel;
    };
    omit?: GlobalOmitConfig;
    comments?: runtime.SqlCommenterPlugin[];
};
export type GlobalOmitConfig = {
    user?: Prisma.UserOmit;
    homeProfile?: Prisma.HomeProfileOmit;
    thermostatDevice?: Prisma.ThermostatDeviceOmit;
    heatingEvent?: Prisma.HeatingEventOmit;
    recommendation?: Prisma.RecommendationOmit;
    weatherCache?: Prisma.WeatherCacheOmit;
    boilerHistory?: Prisma.BoilerHistoryOmit;
    heatingIntervalLearning?: Prisma.HeatingIntervalLearningOmit;
    tuyaToken?: Prisma.TuyaTokenOmit;
};
export type LogLevel = 'info' | 'query' | 'warn' | 'error';
export type LogDefinition = {
    level: LogLevel;
    emit: 'stdout' | 'event';
};
export type CheckIsLogLevel<T> = T extends LogLevel ? T : never;
export type GetLogType<T> = CheckIsLogLevel<T extends LogDefinition ? T['level'] : T>;
export type GetEvents<T extends any[]> = T extends Array<LogLevel | LogDefinition> ? GetLogType<T[number]> : never;
export type QueryEvent = {
    timestamp: Date;
    query: string;
    params: string;
    duration: number;
    target: string;
};
export type LogEvent = {
    timestamp: Date;
    message: string;
    target: string;
};
export type PrismaAction = 'findUnique' | 'findUniqueOrThrow' | 'findMany' | 'findFirst' | 'findFirstOrThrow' | 'create' | 'createMany' | 'createManyAndReturn' | 'update' | 'updateMany' | 'updateManyAndReturn' | 'upsert' | 'delete' | 'deleteMany' | 'executeRaw' | 'queryRaw' | 'aggregate' | 'count' | 'runCommandRaw' | 'findRaw' | 'groupBy';
export type TransactionClient = Omit<DefaultPrismaClient, runtime.ITXClientDenyList>;
