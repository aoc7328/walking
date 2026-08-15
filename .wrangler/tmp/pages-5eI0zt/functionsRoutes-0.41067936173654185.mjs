import { onRequestGet as __api_auth_check_ts_onRequestGet } from "F:\\walking\\functions\\api\\auth\\check.ts"
import { onRequestOptions as __api_auth_check_ts_onRequestOptions } from "F:\\walking\\functions\\api\\auth\\check.ts"
import { onRequestOptions as __api_auth_register_ts_onRequestOptions } from "F:\\walking\\functions\\api\\auth\\register.ts"
import { onRequestPost as __api_auth_register_ts_onRequestPost } from "F:\\walking\\functions\\api\\auth\\register.ts"
import { onRequestGet as __api_trip__id__ts_onRequestGet } from "F:\\walking\\functions\\api\\trip\\[id].ts"
import { onRequestOptions as __api_trip__id__ts_onRequestOptions } from "F:\\walking\\functions\\api\\trip\\[id].ts"
import { onRequestDelete as __api_trips__id__ts_onRequestDelete } from "F:\\walking\\functions\\api\\trips\\[id].ts"
import { onRequestGet as __api_trips__id__ts_onRequestGet } from "F:\\walking\\functions\\api\\trips\\[id].ts"
import { onRequestOptions as __api_trips__id__ts_onRequestOptions } from "F:\\walking\\functions\\api\\trips\\[id].ts"
import { onRequestPut as __api_trips__id__ts_onRequestPut } from "F:\\walking\\functions\\api\\trips\\[id].ts"
import { onRequestDelete as __api_asset___path___ts_onRequestDelete } from "F:\\walking\\functions\\api\\asset\\[[path]].ts"
import { onRequestGet as __api_asset___path___ts_onRequestGet } from "F:\\walking\\functions\\api\\asset\\[[path]].ts"
import { onRequestOptions as __api_asset___path___ts_onRequestOptions } from "F:\\walking\\functions\\api\\asset\\[[path]].ts"
import { onRequestOptions as __api_asset_index_ts_onRequestOptions } from "F:\\walking\\functions\\api\\asset\\index.ts"
import { onRequestPost as __api_asset_index_ts_onRequestPost } from "F:\\walking\\functions\\api\\asset\\index.ts"
import { onRequestOptions as __api_trip_index_ts_onRequestOptions } from "F:\\walking\\functions\\api\\trip\\index.ts"
import { onRequestPost as __api_trip_index_ts_onRequestPost } from "F:\\walking\\functions\\api\\trip\\index.ts"
import { onRequestGet as __api_trips_index_ts_onRequestGet } from "F:\\walking\\functions\\api\\trips\\index.ts"
import { onRequestOptions as __api_trips_index_ts_onRequestOptions } from "F:\\walking\\functions\\api\\trips\\index.ts"

export const routes = [
    {
      routePath: "/api/auth/check",
      mountPath: "/api/auth",
      method: "GET",
      middlewares: [],
      modules: [__api_auth_check_ts_onRequestGet],
    },
  {
      routePath: "/api/auth/check",
      mountPath: "/api/auth",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_auth_check_ts_onRequestOptions],
    },
  {
      routePath: "/api/auth/register",
      mountPath: "/api/auth",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_auth_register_ts_onRequestOptions],
    },
  {
      routePath: "/api/auth/register",
      mountPath: "/api/auth",
      method: "POST",
      middlewares: [],
      modules: [__api_auth_register_ts_onRequestPost],
    },
  {
      routePath: "/api/trip/:id",
      mountPath: "/api/trip",
      method: "GET",
      middlewares: [],
      modules: [__api_trip__id__ts_onRequestGet],
    },
  {
      routePath: "/api/trip/:id",
      mountPath: "/api/trip",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_trip__id__ts_onRequestOptions],
    },
  {
      routePath: "/api/trips/:id",
      mountPath: "/api/trips",
      method: "DELETE",
      middlewares: [],
      modules: [__api_trips__id__ts_onRequestDelete],
    },
  {
      routePath: "/api/trips/:id",
      mountPath: "/api/trips",
      method: "GET",
      middlewares: [],
      modules: [__api_trips__id__ts_onRequestGet],
    },
  {
      routePath: "/api/trips/:id",
      mountPath: "/api/trips",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_trips__id__ts_onRequestOptions],
    },
  {
      routePath: "/api/trips/:id",
      mountPath: "/api/trips",
      method: "PUT",
      middlewares: [],
      modules: [__api_trips__id__ts_onRequestPut],
    },
  {
      routePath: "/api/asset/:path*",
      mountPath: "/api/asset",
      method: "DELETE",
      middlewares: [],
      modules: [__api_asset___path___ts_onRequestDelete],
    },
  {
      routePath: "/api/asset/:path*",
      mountPath: "/api/asset",
      method: "GET",
      middlewares: [],
      modules: [__api_asset___path___ts_onRequestGet],
    },
  {
      routePath: "/api/asset/:path*",
      mountPath: "/api/asset",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_asset___path___ts_onRequestOptions],
    },
  {
      routePath: "/api/asset",
      mountPath: "/api/asset",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_asset_index_ts_onRequestOptions],
    },
  {
      routePath: "/api/asset",
      mountPath: "/api/asset",
      method: "POST",
      middlewares: [],
      modules: [__api_asset_index_ts_onRequestPost],
    },
  {
      routePath: "/api/trip",
      mountPath: "/api/trip",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_trip_index_ts_onRequestOptions],
    },
  {
      routePath: "/api/trip",
      mountPath: "/api/trip",
      method: "POST",
      middlewares: [],
      modules: [__api_trip_index_ts_onRequestPost],
    },
  {
      routePath: "/api/trips",
      mountPath: "/api/trips",
      method: "GET",
      middlewares: [],
      modules: [__api_trips_index_ts_onRequestGet],
    },
  {
      routePath: "/api/trips",
      mountPath: "/api/trips",
      method: "OPTIONS",
      middlewares: [],
      modules: [__api_trips_index_ts_onRequestOptions],
    },
  ]