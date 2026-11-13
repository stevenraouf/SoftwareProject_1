import {
  Global,
  Injectable,
  Module,
  NotFoundException,
  BadRequestException,
} from "@nestjs/common";
import { InjectConnection, MongooseModule } from "@nestjs/mongoose";
import { Schema, Types } from "mongoose";
import type { Connection, ClientSession } from "mongoose";

const str = { type: String, required: true };
const ref = { type: Schema.Types.ObjectId, required: true };
const mixed = Schema.Types.Mixed;
const policy = new Schema(
  {
    threshold: { type: Number, min: 0, required: true },
    refundPercent: { type: Number, min: 0, max: 100, required: true },
  },
  { _id: false },
);
const schemas: Record<string, Schema> = {};
function define(
  name: string,
  fields: Record<string, any>,
  indexes: [Record<string, any>, Record<string, any>?][] = [],
) {
  const schema = new Schema(fields, {
    timestamps: true,
    strict: "throw",
    minimize: false,
    optimisticConcurrency: true,
  });
  for (const [keys, options] of indexes) schema.index(keys, options);
  schemas[name] = schema;
}
define(
  "User",
  {
    name: str,
    email: { ...str, lowercase: true, trim: true },
    passwordHash: str,
    role: {
      type: String,
      enum: ["User", "Admin", "AirlineModerator", "HotelModerator"],
      default: "User",
    },
    status: {
      type: String,
      enum: ["Active", "Suspended", "Deactivated"],
      default: "Active",
    },
    providerId: Schema.Types.ObjectId,
    phone: String,
    preferredCurrency: { type: String, default: "USD" },
    consentAt: { type: Date, required: true },
    failedLogins: { type: Number, default: 0 },
    lockedUntil: Date,
    forcePasswordChange: { type: Boolean, default: false },
    emailVerified: { type: Boolean, default: false },
    verificationHash: String,
    verificationExpires: Date,
    resetHash: String,
    resetExpires: Date,
  },
  [[{ email: 1 }, { unique: true }]],
);
define(
  "Session",
  {
    userId: ref,
    refreshHash: str,
    lastActiveAt: { type: Date, required: true },
    revokedAt: Date,
    csrfHash: str,
  },
  [[{ userId: 1 }]],
);
define("Country", { code: str, name: str, currency: str }, [
  [{ code: 1 }, { unique: true }],
]);
define("City", { city_id: str, name: str, country_code: str }, [
  [{ city_id: 1 }, { unique: true }],
]);
define(
  "Airport",
  {
    iata_code: str,
    name: str,
    city_id: str,
    country_code: str,
    time_zone: str,
  },
  [[{ iata_code: 1 }, { unique: true }]],
);
define("Attraction", { attraction_id: str, name: str, city_id: str }, [
  [{ attraction_id: 1 }, { unique: true }],
]);
define(
  "Provider",
  {
    type: { type: String, enum: ["airline", "hotel"], required: true },
    name: str,
    code: String,
    active: { type: Boolean, default: true },
    logoId: Schema.Types.ObjectId,
    imageIds: [Schema.Types.ObjectId],
    address: String,
    city: String,
    country: String,
    description: String,
    starClass: Number,
    amenities: [String],
    timezone: { type: String, default: "Africa/Cairo" },
    checkInTime: { type: String, default: "14:00" },
    checkOutTime: { type: String, default: "11:00" },
    cancellationTiers: [policy],
    extraBagPrice: { type: Number, default: 0 },
    maxExtraBags: { type: Number, default: 0 },
    averageRating: { type: Number, default: 0 },
    ratingCount: { type: Number, default: 0 },
  },
  [
    [
      { type: 1, code: 1 },
      {
        unique: true,
        partialFilterExpression: { type: "airline", code: { $type: "string" } },
      },
    ],
  ],
);
const cabin = new Schema({
  category: { type: String, required: true },
  capacity: { type: Number, required: true },
  booked: { type: Number, default: 0 },
  held: { type: Number, default: 0 },
  price: { type: Number, required: true },
  freeBags: { type: Number, default: 0 },
  bagWeightKg: { type: Number, default: 23 },
});
define(
  "Flight",
  {
    airlineId: ref,
    flightNumber: str,
    departureAirport: str,
    arrivalAirport: str,
    departureAt: { type: Date, required: true },
    arrivalAt: { type: Date, required: true },
    departureDate: str,
    status: {
      type: String,
      enum: ["Scheduled", "Cancelled", "Departed"],
      default: "Scheduled",
    },
    cabins: [cabin],
  },
  [
    [{ airlineId: 1, flightNumber: 1, departureDate: 1 }, { unique: true }],
    [{ departureAirport: 1, arrivalAirport: 1, departureAt: 1 }],
  ],
);
define(
  "Room",
  {
    hotelId: ref,
    number: str,
    type: str,
    beds: { type: Number, required: true },
    occupancy: { type: Number, required: true },
    price: { type: Number, required: true },
    active: { type: Boolean, default: true },
    everReserved: { type: Boolean, default: false },
    availability: [{ _id: false, start: String, end: String }],
    blocked: [{ _id: false, start: String, end: String }],
  },
  [[{ hotelId: 1, number: 1 }, { unique: true }]],
);
define("RoomNight", { roomId: ref, date: str, bookingId: ref }, [
  [{ roomId: 1, date: 1 }, { unique: true }],
  [{ bookingId: 1 }],
]);
define(
  "Booking",
  {
    type: { type: String, enum: ["flight", "hotel"], required: true },
    userId: ref,
    providerIds: [Schema.Types.ObjectId],
    status: {
      type: String,
      enum: [
        "Pending Payment",
        "Confirmed",
        "Completed",
        "Expired",
        "Cancelled",
      ],
      required: true,
    },
    reference: String,
    holdExpiresAt: Date,
    startsAt: Date,
    endsAt: Date,
    amount: { type: Number, required: true },
    currency: str,
    snapshot: { type: mixed, required: true },
    policySnapshot: { type: mixed, required: true },
    policyAcceptedAt: Date,
    paymentId: Schema.Types.ObjectId,
    confirmedAt: Date,
    cancelledAt: Date,
    cancelReason: String,
    revision: { type: Number, default: 0 },
  },
  [
    [{ reference: 1 }, { unique: true, sparse: true }],
    [{ userId: 1, createdAt: -1 }],
    [{ status: 1, holdExpiresAt: 1 }],
  ],
);
define(
  "Payment",
  {
    bookingId: ref,
    userId: ref,
    purpose: { type: String, enum: ["booking", "change"], default: "booking" },
    changeId: Schema.Types.ObjectId,
    stripeId: String,
    amount: { type: Number, required: true },
    currency: str,
    status: {
      type: String,
      enum: ["Creating", "Pending", "Succeeded", "Failed", "Cancelled"],
      default: "Creating",
    },
    attempt: { type: Number, default: 1 },
  },
  [
    [{ stripeId: 1 }, { unique: true, sparse: true }],
    [{ bookingId: 1, purpose: 1, changeId: 1, attempt: 1 }, { unique: true }],
  ],
);
define(
  "Refund",
  {
    bookingId: ref,
    userId: ref,
    paymentId: ref,
    amount: { type: Number, required: true },
    currency: str,
    reason: str,
    key: str,
    stripeId: String,
    status: {
      type: String,
      enum: ["Pending", "Refunded", "Failed"],
      default: "Pending",
    },
    error: String,
  },
  [
    [{ key: 1 }, { unique: true }],
    [{ stripeId: 1 }, { unique: true, sparse: true }],
  ],
);
define(
  "StripeEvent",
  { eventId: str, type: str, processedAt: Date, payload: mixed },
  [[{ eventId: 1 }, { unique: true }]],
);
define(
  "Outbox",
  {
    key: str,
    kind: str,
    payload: mixed,
    state: {
      type: String,
      enum: ["Pending", "Running", "Done"],
      default: "Pending",
    },
    attempts: { type: Number, default: 0 },
    nextAttemptAt: { type: Date, default: Date.now },
    leaseUntil: Date,
    error: String,
  },
  [[{ key: 1 }, { unique: true }], [{ state: 1, nextAttemptAt: 1 }]],
);
define(
  "FlightChange",
  {
    bookingId: ref,
    userId: ref,
    status: {
      type: String,
      enum: ["Pending Payment", "Committed", "Expired"],
      default: "Pending Payment",
    },
    expiresAt: Date,
    snapshot: mixed,
    difference: Number,
    amount: Number,
    policySnapshot: mixed,
    revision: Number,
    paymentId: Schema.Types.ObjectId,
    policyAcceptedAt: Date,
  },
  [
    [
      { bookingId: 1 },
      { unique: true, partialFilterExpression: { status: "Pending Payment" } },
    ],
  ],
);
define(
  "Seat",
  {
    flightId: ref,
    category: str,
    label: str,
    bookingId: ref,
    passengerIndex: { type: Number, required: true },
  },
  [
    [{ flightId: 1, category: 1, label: 1 }, { unique: true }],
    [{ flightId: 1, bookingId: 1, passengerIndex: 1 }, { unique: true }],
  ],
);
const activity = new Schema({
  name: str,
  description: { type: String, default: "" },
  time: String,
  cost: { type: Number, default: 0 },
  currency: { type: String, default: "USD" },
  imageIds: [Schema.Types.ObjectId],
});
const budget = new Schema({
  category: str,
  amount: { type: Number, required: true },
  currency: str,
});
const day = new Schema({
  city: str,
  notes: { type: String, default: "" },
  activities: [activity],
  budgets: [budget],
});
define(
  "Itinerary",
  {
    userId: ref,
    title: str,
    countries: [String],
    startDate: str,
    visibility: {
      type: String,
      enum: ["Private", "Public"],
      default: "Private",
    },
    hidden: { type: Boolean, default: false },
    originalAuthorId: Schema.Types.ObjectId,
    sourceItineraryId: Schema.Types.ObjectId,
    days: [day],
    transportCosts: [
      {
        mode: String,
        fromCity: String,
        toCity: String,
        amount: Number,
        currency: String,
        dayId: Schema.Types.ObjectId,
      },
    ],
    bookingLinks: [
      { bookingId: Schema.Types.ObjectId, dayId: Schema.Types.ObjectId },
    ],
  },
  [[{ userId: 1, updatedAt: -1 }]],
);
define(
  "ExchangeRate",
  {
    base: str,
    date: str,
    rates: { type: mixed, required: true },
    fetchedAt: Date,
  },
  [[{ base: 1, date: 1 }, { unique: true }]],
);
define(
  "Post",
  {
    userId: ref,
    title: str,
    body: str,
    tags: [String],
    imageIds: [Schema.Types.ObjectId],
    status: { type: String, enum: ["Draft", "Published"], default: "Draft" },
    hidden: { type: Boolean, default: false },
    itineraryId: Schema.Types.ObjectId,
  },
  [[{ status: 1, createdAt: -1 }]],
);
define(
  "Comment",
  {
    postId: ref,
    userId: ref,
    body: str,
    hidden: { type: Boolean, default: false },
  },
  [[{ postId: 1, createdAt: 1 }]],
);
define("Like", { postId: ref, userId: ref }, [
  [{ postId: 1, userId: 1 }, { unique: true }],
]);
define(
  "Review",
  {
    bookingId: ref,
    hotelId: ref,
    userId: ref,
    rating: { type: Number, min: 1, max: 5, required: true },
    body: { type: String, default: "" },
    hidden: { type: Boolean, default: false },
    reply: String,
  },
  [[{ bookingId: 1 }, { unique: true }]],
);
define(
  "Report",
  {
    userId: ref,
    contentType: str,
    contentId: ref,
    reason: str,
    status: {
      type: String,
      enum: ["Open", "Dismissed", "Hidden", "Deleted"],
      default: "Open",
    },
    resolvedBy: Schema.Types.ObjectId,
  },
  [[{ userId: 1, contentType: 1, contentId: 1 }, { unique: true }]],
);
define(
  "Notification",
  { userId: ref, message: str, link: String, readAt: Date, key: str },
  [[{ key: 1 }, { unique: true }], [{ userId: 1, createdAt: -1 }]],
);
define(
  "Audit",
  { actorId: ref, action: str, targetType: str, targetId: ref, detail: mixed },
  [[{ createdAt: -1 }]],
);
define("Media", {
  userId: ref,
  resourceType: str,
  resourceId: ref,
  filename: str,
  mime: str,
  size: Number,
});
define("Favourite", { userId: ref, type: str, resourceId: ref }, [
  [{ userId: 1, type: 1, resourceId: 1 }, { unique: true }],
]);

export function oid(value: string | Types.ObjectId): Types.ObjectId {
  if (!Types.ObjectId.isValid(value))
    throw new BadRequestException("Invalid resource identifier");
  return new Types.ObjectId(value);
}
export function same(a: any, b: any): boolean {
  return String(a) === String(b);
}
@Injectable()
export class Db {
  constructor(@InjectConnection() readonly connection: Connection) {}
  // Mongoose's dynamic registry is the persistence boundary; DTOs validate all HTTP inputs.
  model(name: string): any {
    return this.connection.model(name);
  }
  async get(
    name: string,
    id: string | Types.ObjectId,
    session?: ClientSession,
  ): Promise<any> {
    const doc = await this.model(name)
      .findById(oid(id))
      .session(session ?? null);
    if (!doc) throw new NotFoundException(`${name} not found`);
    return doc;
  }
  async transaction<T>(fn: (session: ClientSession) => Promise<T>): Promise<T> {
    const session = await this.connection.startSession();
    try {
      return (await session.withTransaction(() => fn(session))) as T;
    } finally {
      await session.endSession();
    }
  }
}
@Global()
@Module({
  imports: [
    MongooseModule.forFeature(
      Object.entries(schemas).map(([name, schema]) => ({ name, schema })),
    ),
  ],
  providers: [Db],
  exports: [Db, MongooseModule],
})
export class DatabaseModule {}
