import * as runtime from "@prisma/client/runtime/index-browser";
export type * from '../models.js';
export type * from './prismaNamespace.js';
export declare const Decimal: typeof runtime.Decimal;
export declare const NullTypes: {
    DbNull: (new (secret: never) => typeof runtime.DbNull);
    JsonNull: (new (secret: never) => typeof runtime.JsonNull);
    AnyNull: (new (secret: never) => typeof runtime.AnyNull);
};
export declare const DbNull: import("@prisma/client-runtime-utils").DbNullClass;
export declare const JsonNull: import("@prisma/client-runtime-utils").JsonNullClass;
export declare const AnyNull: import("@prisma/client-runtime-utils").AnyNullClass;
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
