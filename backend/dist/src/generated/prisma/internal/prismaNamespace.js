"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.defineExtension = exports.TuyaTokenOrderByRelevanceFieldEnum = exports.HeatingIntervalLearningOrderByRelevanceFieldEnum = exports.WeatherCacheOrderByRelevanceFieldEnum = exports.HeatingEventOrderByRelevanceFieldEnum = exports.ThermostatDeviceOrderByRelevanceFieldEnum = exports.HomeProfileOrderByRelevanceFieldEnum = exports.UserOrderByRelevanceFieldEnum = exports.NullsOrder = exports.SortOrder = exports.TuyaTokenScalarFieldEnum = exports.HeatingIntervalLearningScalarFieldEnum = exports.BoilerHistoryScalarFieldEnum = exports.WeatherCacheScalarFieldEnum = exports.RecommendationScalarFieldEnum = exports.HeatingEventScalarFieldEnum = exports.ThermostatDeviceScalarFieldEnum = exports.HomeProfileScalarFieldEnum = exports.UserScalarFieldEnum = exports.TransactionIsolationLevel = exports.ModelName = exports.AnyNull = exports.JsonNull = exports.DbNull = exports.NullTypes = exports.prismaVersion = exports.getExtensionContext = exports.Decimal = exports.Sql = exports.raw = exports.join = exports.empty = exports.sql = exports.PrismaClientValidationError = exports.PrismaClientInitializationError = exports.PrismaClientRustPanicError = exports.PrismaClientUnknownRequestError = exports.PrismaClientKnownRequestError = void 0;
const runtime = __importStar(require("@prisma/client/runtime/client"));
exports.PrismaClientKnownRequestError = runtime.PrismaClientKnownRequestError;
exports.PrismaClientUnknownRequestError = runtime.PrismaClientUnknownRequestError;
exports.PrismaClientRustPanicError = runtime.PrismaClientRustPanicError;
exports.PrismaClientInitializationError = runtime.PrismaClientInitializationError;
exports.PrismaClientValidationError = runtime.PrismaClientValidationError;
exports.sql = runtime.sqltag;
exports.empty = runtime.empty;
exports.join = runtime.join;
exports.raw = runtime.raw;
exports.Sql = runtime.Sql;
exports.Decimal = runtime.Decimal;
exports.getExtensionContext = runtime.Extensions.getExtensionContext;
exports.prismaVersion = {
    client: "7.2.0",
    engine: "0c8ef2ce45c83248ab3df073180d5eda9e8be7a3"
};
exports.NullTypes = {
    DbNull: runtime.NullTypes.DbNull,
    JsonNull: runtime.NullTypes.JsonNull,
    AnyNull: runtime.NullTypes.AnyNull,
};
exports.DbNull = runtime.DbNull;
exports.JsonNull = runtime.JsonNull;
exports.AnyNull = runtime.AnyNull;
exports.ModelName = {
    User: 'User',
    HomeProfile: 'HomeProfile',
    ThermostatDevice: 'ThermostatDevice',
    HeatingEvent: 'HeatingEvent',
    Recommendation: 'Recommendation',
    WeatherCache: 'WeatherCache',
    BoilerHistory: 'BoilerHistory',
    HeatingIntervalLearning: 'HeatingIntervalLearning',
    TuyaToken: 'TuyaToken'
};
exports.TransactionIsolationLevel = runtime.makeStrictEnum({
    ReadUncommitted: 'ReadUncommitted',
    ReadCommitted: 'ReadCommitted',
    RepeatableRead: 'RepeatableRead',
    Serializable: 'Serializable'
});
exports.UserScalarFieldEnum = {
    id: 'id',
    email: 'email',
    passwordHash: 'passwordHash',
    name: 'name',
    homeLocation: 'homeLocation',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.HomeProfileScalarFieldEnum = {
    id: 'id',
    userId: 'userId',
    floorArea: 'floorArea',
    ceilingHeight: 'ceilingHeight',
    insulationType: 'insulationType',
    insulationThickness: 'insulationThickness',
    windowType: 'windowType',
    heatingType: 'heatingType',
    constructionYear: 'constructionYear',
    learningOffset: 'learningOffset',
    learningConfidence: 'learningConfidence',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.ThermostatDeviceScalarFieldEnum = {
    id: 'id',
    userId: 'userId',
    homeProfileId: 'homeProfileId',
    vendor: 'vendor',
    deviceId: 'deviceId',
    alias: 'alias',
    lastSeen: 'lastSeen',
    mode: 'mode',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.HeatingEventScalarFieldEnum = {
    id: 'id',
    deviceId: 'deviceId',
    timestampStart: 'timestampStart',
    timestampEnd: 'timestampEnd',
    currentTemp: 'currentTemp',
    targetTemp: 'targetTemp',
    hvacAction: 'hvacAction',
    source: 'source',
    createdAt: 'createdAt'
};
exports.RecommendationScalarFieldEnum = {
    id: 'id',
    userId: 'userId',
    date: 'date',
    recommendedFlowTemp: 'recommendedFlowTemp',
    expectedHeatTimeMin: 'expectedHeatTimeMin',
    confidenceScore: 'confidenceScore',
    createdAt: 'createdAt'
};
exports.WeatherCacheScalarFieldEnum = {
    id: 'id',
    city: 'city',
    temperature: 'temperature',
    feelslike: 'feelslike',
    temp_min: 'temp_min',
    temp_max: 'temp_max',
    temp_avg: 'temp_avg',
    wind_kph: 'wind_kph',
    gust_kph: 'gust_kph',
    wind_dir: 'wind_dir',
    pressure_mb: 'pressure_mb',
    humidity: 'humidity',
    cloud: 'cloud',
    uv_index: 'uv_index',
    precipitation_mm: 'precipitation_mm',
    snow_cm: 'snow_cm',
    condition_text: 'condition_text',
    sunrise: 'sunrise',
    sunset: 'sunset',
    moonrise: 'moonrise',
    moonset: 'moonset',
    moon_phase: 'moon_phase',
    moon_illumination: 'moon_illumination',
    fetchedAt: 'fetchedAt'
};
exports.BoilerHistoryScalarFieldEnum = {
    id: 'id',
    userId: 'userId',
    externalTemp: 'externalTemp',
    suggestedTemp: 'suggestedTemp',
    actualTemp: 'actualTemp',
    heatingStart: 'heatingStart',
    heatingEnd: 'heatingEnd',
    createdAt: 'createdAt'
};
exports.HeatingIntervalLearningScalarFieldEnum = {
    id: 'id',
    homeProfileId: 'homeProfileId',
    intervalKey: 'intervalKey',
    avgReachTimeMin: 'avgReachTimeMin',
    avgOvershoot: 'avgOvershoot',
    offset: 'offset',
    confidence: 'confidence',
    samples: 'samples',
    lastUpdated: 'lastUpdated'
};
exports.TuyaTokenScalarFieldEnum = {
    id: 'id',
    accessToken: 'accessToken',
    expiresAt: 'expiresAt',
    createdAt: 'createdAt',
    updatedAt: 'updatedAt'
};
exports.SortOrder = {
    asc: 'asc',
    desc: 'desc'
};
exports.NullsOrder = {
    first: 'first',
    last: 'last'
};
exports.UserOrderByRelevanceFieldEnum = {
    email: 'email',
    passwordHash: 'passwordHash',
    name: 'name',
    homeLocation: 'homeLocation'
};
exports.HomeProfileOrderByRelevanceFieldEnum = {
    insulationType: 'insulationType',
    windowType: 'windowType',
    heatingType: 'heatingType'
};
exports.ThermostatDeviceOrderByRelevanceFieldEnum = {
    vendor: 'vendor',
    deviceId: 'deviceId',
    alias: 'alias'
};
exports.HeatingEventOrderByRelevanceFieldEnum = {
    hvacAction: 'hvacAction',
    source: 'source'
};
exports.WeatherCacheOrderByRelevanceFieldEnum = {
    city: 'city',
    wind_dir: 'wind_dir',
    condition_text: 'condition_text',
    sunrise: 'sunrise',
    sunset: 'sunset',
    moonrise: 'moonrise',
    moonset: 'moonset',
    moon_phase: 'moon_phase'
};
exports.HeatingIntervalLearningOrderByRelevanceFieldEnum = {
    intervalKey: 'intervalKey'
};
exports.TuyaTokenOrderByRelevanceFieldEnum = {
    accessToken: 'accessToken'
};
exports.defineExtension = runtime.Extensions.defineExtension;
//# sourceMappingURL=prismaNamespace.js.map