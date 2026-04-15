import {
  pgTable,
  text,
  varchar,
  integer,
  real,
  boolean,
  timestamp,
  json,
  index,
  pgEnum,
} from "drizzle-orm/pg-core";
import { relations } from "drizzle-orm";

// ─── Enums ─────────────────────────────────────────────────────────────────

export const userRoleEnum = pgEnum("user_role", [
  "passenger",
  "driver",
  "admin",
]);

export const busStatusEnum = pgEnum("bus_status", [
  "active",
  "inactive",
  "maintenance",
]);

export const routeStatusEnum = pgEnum("route_status", [
  "active",
  "inactive",
  "suspended",
]);

export const recommendationStatusEnum = pgEnum("recommendation_status", [
  "pending",
  "accepted",
  "rejected",
  "expired",
]);

export const issueStatusEnum = pgEnum("issue_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

export const issuePriorityEnum = pgEnum("issue_priority", [
  "low",
  "medium",
  "high",
  "critical",
]);

// ─── Users (Better-Auth managed) ──────────────────────────────────────────

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").notNull().default(false),
  image: text("image"),
  role: userRoleEnum("role").notNull().default("passenger"),
  phone: varchar("phone", { length: 20 }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const sessions = pgTable("sessions", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expires_at").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
});

export const accounts = pgTable("accounts", {
  id: text("id").primaryKey(),
  accountId: text("account_id").notNull(),
  providerId: text("provider_id").notNull(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  accessToken: text("access_token"),
  refreshToken: text("refresh_token"),
  idToken: text("id_token"),
  accessTokenExpiresAt: timestamp("access_token_expires_at"),
  refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("created_at").notNull(),
  updatedAt: timestamp("updated_at").notNull(),
});

export const verifications = pgTable("verifications", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at"),
  updatedAt: timestamp("updated_at"),
});

// ─── Routes ────────────────────────────────────────────────────────────────

export const routes = pgTable("routes", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }).notNull(),
  number: varchar("number", { length: 20 }).notNull().unique(),
  description: text("description"),
  color: varchar("color", { length: 7 }).notNull().default("#3B82F6"),
  status: routeStatusEnum("status").notNull().default("active"),
  startStopId: text("start_stop_id"),
  endStopId: text("end_stop_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Bus Stops ─────────────────────────────────────────────────────────────

export const busStops = pgTable(
  "bus_stops",
  {
    id: text("id").primaryKey(),
    name: varchar("name", { length: 100 }).notNull(),
    code: varchar("code", { length: 20 }),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    address: text("address"),
    imageUrl: text("image_url"),
    amenities: json("amenities").$type<string[]>().default([]),
    createdAt: timestamp("created_at").notNull().defaultNow(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("bus_stops_lat_lng_idx").on(table.latitude, table.longitude)]
);

// ─── Route Stops (junction table with ordering) ────────────────────────────

export const routeStops = pgTable("route_stops", {
  id: text("id").primaryKey(),
  routeId: text("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  stopId: text("stop_id")
    .notNull()
    .references(() => busStops.id, { onDelete: "cascade" }),
  stopOrder: integer("stop_order").notNull(),
  distanceFromPrev: real("distance_from_prev").default(0),
  estimatedMinutesFromStart: integer("estimated_minutes_from_start").default(0),
});

// ─── Buses ─────────────────────────────────────────────────────────────────

export const buses = pgTable("buses", {
  id: text("id").primaryKey(),
  name: varchar("name", { length: 100 }),
  number: varchar("number", { length: 20 }).notNull().unique(),
  registrationNumber: varchar("registration_number", { length: 30 }),
  capacity: integer("capacity").notNull().default(40),
  busType: varchar("bus_type", { length: 20 }).default("Non-AC"),
  currentRouteId: text("current_route_id").references(() => routes.id),
  driverId: text("driver_id").references(() => users.id),
  manualDriverName: varchar("manual_driver_name", { length: 100 }),
  status: busStatusEnum("status").notNull().default("inactive"),
  imageUrl: text("image_url"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Bus Locations (current) ───────────────────────────────────────────────

export const busLocations = pgTable(
  "bus_locations",
  {
    id: text("id").primaryKey(),
    busId: text("bus_id")
      .notNull()
      .unique()
      .references(() => buses.id, { onDelete: "cascade" }),
    latitude: real("latitude").notNull(),
    longitude: real("longitude").notNull(),
    speed: real("speed").notNull().default(0),
    heading: real("heading").notNull().default(0),
    currentStopIndex: integer("current_stop_index").default(0),
    nextStopId: text("next_stop_id").references(() => busStops.id),
    isReverse: boolean("is_reverse").default(false),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [index("bus_locations_bus_id_idx").on(table.busId)]
);

// ─── ETA Predictions ───────────────────────────────────────────────────────

export const etaPredictions = pgTable(
  "eta_predictions",
  {
    id: text("id").primaryKey(),
    busId: text("bus_id")
      .notNull()
      .references(() => buses.id, { onDelete: "cascade" }),
    stopId: text("stop_id")
      .notNull()
      .references(() => busStops.id, { onDelete: "cascade" }),
    predictedArrival: timestamp("predicted_arrival").notNull(),
    confidence: integer("confidence").notNull().default(70),
    minutesAway: integer("minutes_away").notNull(),
    updatedAt: timestamp("updated_at").notNull().defaultNow(),
  },
  (table) => [
    index("eta_bus_stop_idx").on(table.busId, table.stopId),
  ]
);

// ─── Historical Data (for ETA learning) ───────────────────────────────────

export const historicalData = pgTable("historical_data", {
  id: text("id").primaryKey(),
  busId: text("bus_id")
    .notNull()
    .references(() => buses.id, { onDelete: "cascade" }),
  routeId: text("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  stopId: text("stop_id")
    .notNull()
    .references(() => busStops.id, { onDelete: "cascade" }),
  scheduledArrival: timestamp("scheduled_arrival"),
  actualArrival: timestamp("actual_arrival").notNull(),
  delayMinutes: integer("delay_minutes").notNull().default(0),
  dayOfWeek: integer("day_of_week").notNull(),
  hourOfDay: integer("hour_of_day").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Traffic Conditions ────────────────────────────────────────────────────

export const trafficConditions = pgTable("traffic_conditions", {
  id: text("id").primaryKey(),
  segmentStartLat: real("segment_start_lat").notNull(),
  segmentStartLng: real("segment_start_lng").notNull(),
  segmentEndLat: real("segment_end_lat").notNull(),
  segmentEndLng: real("segment_end_lng").notNull(),
  trafficLevel: integer("traffic_level").notNull().default(1),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Route Recommendations ─────────────────────────────────────────────────

export const routeRecommendations = pgTable("route_recommendations", {
  id: text("id").primaryKey(),
  busId: text("bus_id")
    .notNull()
    .references(() => buses.id, { onDelete: "cascade" }),
  currentRouteId: text("current_route_id")
    .notNull()
    .references(() => routes.id),
  recommendedRouteId: text("recommended_route_id").references(() => routes.id),
  reason: text("reason").notNull(),
  timeSavedMinutes: integer("time_saved_minutes").notNull().default(0),
  priority: integer("priority").notNull().default(1),
  status: recommendationStatusEnum("status").notNull().default("pending"),
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  respondedAt: timestamp("responded_at"),
});

// ─── Chat Messages ─────────────────────────────────────────────────────────

export const chatMessages = pgTable("chat_messages", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  userMessage: text("user_message").notNull(),
  aiResponse: text("ai_response").notNull(),
  contextData: json("context_data"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Favorite Routes ───────────────────────────────────────────────────────

export const favoriteRoutes = pgTable("favorite_routes", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  routeId: text("route_id")
    .notNull()
    .references(() => routes.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Issues ────────────────────────────────────────────────────────────────

export const issues = pgTable("issues", {
  id: text("id").primaryKey(),
  reportedById: text("reported_by_id").references(() => users.id),
  stopId: text("stop_id").references(() => busStops.id),
  busId: text("bus_id").references(() => buses.id),
  title: varchar("title", { length: 200 }).notNull(),
  description: text("description").notNull(),
  imageUrl: text("image_url"),
  status: issueStatusEnum("status").notNull().default("open"),
  priority: issuePriorityEnum("priority").notNull().default("medium"),
  resolvedAt: timestamp("resolved_at"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

// ─── Notifications ─────────────────────────────────────────────────────────

export const notifications = pgTable("notifications", {
  id: text("id").primaryKey(),
  userId: text("user_id")
    .notNull()
    .references(() => users.id, { onDelete: "cascade" }),
  title: varchar("title", { length: 200 }).notNull(),
  message: text("message").notNull(),
  type: varchar("type", { length: 50 }).notNull().default("info"),
  read: boolean("read").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ─── Relations ─────────────────────────────────────────────────────────────

export const routesRelations = relations(routes, ({ many }) => ({
  routeStops: many(routeStops),
  buses: many(buses),
  favoriteRoutes: many(favoriteRoutes),
  recommendations: many(routeRecommendations),
}));

export const busStopsRelations = relations(busStops, ({ many }) => ({
  routeStops: many(routeStops),
  etaPredictions: many(etaPredictions),
  historicalData: many(historicalData),
}));

export const routeStopsRelations = relations(routeStops, ({ one }) => ({
  route: one(routes, { fields: [routeStops.routeId], references: [routes.id] }),
  stop: one(busStops, { fields: [routeStops.stopId], references: [busStops.id] }),
}));

export const busesRelations = relations(buses, ({ one, many }) => ({
  route: one(routes, { fields: [buses.currentRouteId], references: [routes.id] }),
  driver: one(users, { fields: [buses.driverId], references: [users.id] }),
  location: one(busLocations, { fields: [buses.id], references: [busLocations.busId] }),
  etaPredictions: many(etaPredictions),
  recommendations: many(routeRecommendations),
  historicalData: many(historicalData),
}));

export const busLocationsRelations = relations(busLocations, ({ one }) => ({
  bus: one(buses, { fields: [busLocations.busId], references: [buses.id] }),
  nextStop: one(busStops, { fields: [busLocations.nextStopId], references: [busStops.id] }),
}));

export const etaPredictionsRelations = relations(etaPredictions, ({ one }) => ({
  bus: one(buses, { fields: [etaPredictions.busId], references: [buses.id] }),
  stop: one(busStops, { fields: [etaPredictions.stopId], references: [busStops.id] }),
}));

export const historicalDataRelations = relations(historicalData, ({ one }) => ({
  bus: one(buses, { fields: [historicalData.busId], references: [buses.id] }),
  route: one(routes, { fields: [historicalData.routeId], references: [routes.id] }),
  stop: one(busStops, { fields: [historicalData.stopId], references: [busStops.id] }),
}));

export const routeRecommendationsRelations = relations(routeRecommendations, ({ one }) => ({
  bus: one(buses, { fields: [routeRecommendations.busId], references: [buses.id] }),
  currentRoute: one(routes, { fields: [routeRecommendations.currentRouteId], references: [routes.id] }),
}));

export const favoriteRoutesRelations = relations(favoriteRoutes, ({ one }) => ({
  user: one(users, { fields: [favoriteRoutes.userId], references: [users.id] }),
  route: one(routes, { fields: [favoriteRoutes.routeId], references: [routes.id] }),
}));

export const chatMessagesRelations = relations(chatMessages, ({ one }) => ({
  user: one(users, { fields: [chatMessages.userId], references: [users.id] }),
}));

export const notificationsRelations = relations(notifications, ({ one }) => ({
  user: one(users, { fields: [notifications.userId], references: [users.id] }),
}));

export const issuesRelations = relations(issues, ({ one }) => ({
  reportedBy: one(users, { fields: [issues.reportedById], references: [users.id] }),
  stop: one(busStops, { fields: [issues.stopId], references: [busStops.id] }),
  bus: one(buses, { fields: [issues.busId], references: [buses.id] }),
}));

export const usersRelations = relations(users, ({ many }) => ({
  favoriteRoutes: many(favoriteRoutes),
  chatMessages: many(chatMessages),
  notifications: many(notifications),
  issues: many(issues),
}));
