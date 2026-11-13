import { Global, Module } from "@nestjs/common";
import { APP_GUARD } from "@nestjs/core";
import { MongooseModule } from "@nestjs/mongoose";
import { ScheduleModule } from "@nestjs/schedule";
import { DatabaseModule } from "./database.js";
import { Ops } from "./ops.js";
import {
  AuthController,
  AuthGuard,
  AuthService,
  UsersController,
} from "./auth/auth.js";
import { Inventory } from "./bookings/inventory.js";
import {
  AirlinesController,
  FlightsController,
  FlightsService,
} from "./flights/flights.js";
import { HotelsController, HotelsService } from "./hotels/hotels.js";
import {
  BookingsService,
  FlightBookingsController,
  HotelBookingsController,
  PoliciesController,
} from "./bookings/bookings.js";
import {
  FlightChangesController,
  PaymentsController,
  PaymentsService,
  RefundsController,
} from "./payments/payments.js";
import {
  ItinerariesController,
  ItinerariesService,
  ItineraryItemsController,
} from "./itineraries/itineraries.js";
import {
  CommunityController,
  CommunityService,
  PostsController,
} from "./community/community.js";
import { AdminController, AdminService } from "./admin/admin.js";
import {
  ReferenceController,
  SupportController,
  SupportService,
} from "./support/support.js";
import { MediaController, MediaService } from "./media/media.js";
import { Jobs } from "./jobs.js";

@Global()
@Module({ providers: [Ops, Inventory], exports: [Ops, Inventory] })
class InfrastructureModule {}
@Module({
  providers: [AuthService],
  controllers: [AuthController, UsersController],
})
class AuthenticationModule {}
@Module({
  providers: [FlightsService],
  controllers: [AirlinesController, FlightsController],
  exports: [FlightsService],
})
class FlightsModule {}
@Module({
  providers: [HotelsService],
  controllers: [HotelsController],
  exports: [HotelsService],
})
class HotelsModule {}
@Module({
  providers: [BookingsService],
  controllers: [
    FlightBookingsController,
    HotelBookingsController,
    PoliciesController,
  ],
  exports: [BookingsService],
})
class BookingsModule {}
@Module({
  imports: [BookingsModule],
  providers: [PaymentsService],
  controllers: [PaymentsController, RefundsController, FlightChangesController],
  exports: [PaymentsService],
})
class PaymentsModule {}
@Module({
  imports: [FlightsModule, HotelsModule],
  providers: [ItinerariesService],
  controllers: [ItinerariesController, ItineraryItemsController],
  exports: [ItinerariesService],
})
class ItinerariesModule {}
@Module({
  imports: [BookingsModule, ItinerariesModule],
  providers: [CommunityService],
  controllers: [PostsController, CommunityController],
  exports: [CommunityService],
})
class CommunityModule {}
@Module({
  imports: [CommunityModule],
  providers: [AdminService],
  controllers: [AdminController],
})
class AdministrationModule {}
@Module({
  imports: [ItinerariesModule],
  providers: [SupportService],
  controllers: [ReferenceController, SupportController],
})
class SupportingServicesModule {}
@Module({
  imports: [CommunityModule, ItinerariesModule],
  providers: [MediaService],
  controllers: [MediaController],
})
class MediaModule {}
@Module({ imports: [BookingsModule, PaymentsModule], providers: [Jobs] })
class JobsModule {}
@Module({
  imports: [
    MongooseModule.forRootAsync({
      useFactory: () => ({
        uri: process.env.MONGODB_URI,
        serverSelectionTimeoutMS: 10000,
      }),
    }),
    DatabaseModule,
    InfrastructureModule,
    ScheduleModule.forRoot(),
    AuthenticationModule,
    FlightsModule,
    HotelsModule,
    BookingsModule,
    PaymentsModule,
    ItinerariesModule,
    CommunityModule,
    AdministrationModule,
    SupportingServicesModule,
    MediaModule,
    JobsModule,
  ],
  providers: [{ provide: APP_GUARD, useClass: AuthGuard }],
})
export class AppModule {}
