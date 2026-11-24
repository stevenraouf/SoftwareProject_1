import { applyDecorators } from "@nestjs/common";
import { ApiProperty, PartialType } from "@nestjs/swagger";
import {
  ArrayMaxSize,
  ArrayMinSize,
  ArrayUnique,
  Equals,
  IsArray,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsInt,
  IsMongoId,
  IsNumber,
  ValidateIf,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from "class-validator";
import { Type } from "class-transformer";

function OptionalField() {
  return ValidateIf((_object, value) => value !== undefined);
}

function Text(min = 1, max = 200, optional = false) {
  return applyDecorators(
    ApiProperty({
      type: String,
      required: !optional,
      minLength: min,
      maxLength: max,
    }),
    ...(optional ? [OptionalField()] : []),
    IsString(),
    ...(min > 0
      ? [Matches(/\S/, { message: "must contain a non-whitespace character" })]
      : []),
    MinLength(min),
    MaxLength(max),
  );
}
function Num(min = 0, max = 1e8, integer = false, optional = false) {
  return applyDecorators(
    ApiProperty({
      type: Number,
      required: !optional,
      minimum: min,
      maximum: max,
    }),
    ...(optional ? [OptionalField()] : []),
    Type(() => Number),
    ...(integer ? [IsInt()] : [IsNumber()]),
    Min(min),
    Max(max),
  );
}
function Id(optional = false) {
  return applyDecorators(
    ApiProperty({
      type: String,
      required: !optional,
      example: "507f1f77bcf86cd799439011",
    }),
    ...(optional ? [OptionalField()] : []),
    IsMongoId(),
  );
}
function Choice(values: string[], optional = false) {
  return applyDecorators(
    ApiProperty({ enum: values, required: !optional }),
    ...(optional ? [OptionalField()] : []),
    IsEnum(Object.fromEntries(values.map((v) => [v, v]))),
  );
}
function DateField(optional = false) {
  return applyDecorators(
    Text(10, 10, optional),
    Matches(/^\d{4}-\d{2}-\d{2}$/),
  );
}
function Password() {
  return applyDecorators(
    Text(8, 128),
    Matches(/^(?=.*[A-Za-z])(?=.*\d).{8,128}$/, {
      message:
        "password must contain at least 8 characters, a letter and a digit",
    }),
  );
}
function Currency(optional = false) {
  return applyDecorators(Text(3, 3, optional), Matches(/^[A-Z]{3}$/));
}
function ListStrings(max: number, optional = false, min = 0) {
  return applyDecorators(
    ApiProperty({ type: [String], required: !optional }),
    ...(optional ? [OptionalField()] : []),
    IsArray(),
    ArrayMinSize(min),
    ArrayMaxSize(max),
    ArrayUnique(),
    IsString({ each: true }),
  );
}
export class RegisterDto {
  @Text(1, 100) name!: string;
  @ApiProperty({ example: "traveler@example.test" })
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @Password() password!: string;
  @ApiProperty({ example: true }) @Equals(true) consent!: boolean;
}
export class LoginDto {
  @ApiProperty() @IsEmail() email!: string;
  @Text(1, 128) password!: string;
}
export class ChangePasswordDto {
  @Text(1, 128) currentPassword!: string;
  @Password() newPassword!: string;
}
export class TemporaryPasswordDto {
  @Password() temporaryPassword!: string;
}
export class ResetPasswordDto {
  @Text(64, 64) token!: string;
  @Password() newPassword!: string;
}
export class ForgotPasswordDto {
  @ApiProperty() @IsEmail() email!: string;
}
export class ProfileDto {
  @Text(1, 100, true) name?: string;
  @Text(0, 25, true) @Matches(/^\+?[0-9 ()-]{0,25}$/) phone?: string;
  @Currency(true) preferredCurrency?: string;
}
export class ConfirmDto {
  @ApiProperty({ example: true }) @Equals(true) confirm!: boolean;
}
export class ModeratorDto {
  @Text(1, 100) name!: string;
  @ApiProperty() @IsEmail() email!: string;
  @Choice(["AirlineModerator", "HotelModerator"]) role!: string;
  @Id() providerId!: string;
  @Password() temporaryPassword!: string;
}
export class PageDto {
  @Num(1, 1e6, true, true) page = 1;
}
export class AccountQueryDto extends PageDto {
  @Text(0, 100, true) q?: string;
  @Choice(["User", "Admin", "AirlineModerator", "HotelModerator"], true)
  role?: string;
  @Choice(["Active", "Suspended", "Deactivated"], true) status?: string;
}
export class BookingQueryDto extends PageDto {
  @Choice(["flight", "hotel"], true) type?: string;
  @Choice(
    ["Pending Payment", "Confirmed", "Completed", "Expired", "Cancelled"],
    true,
  )
  status?: string;
  @Choice(["Upcoming", "Past", "Cancelled"], true) group?: string;
  @DateField(true) from?: string;
  @DateField(true) to?: string;
}
export class AirlineDto {
  @Text(1, 100) name!: string;
  @Text(2, 8) @Matches(/^[A-Z0-9]{2,8}$/) code!: string;
}
export class PatchAirlineDto extends PartialType(AirlineDto, {
  skipNullProperties: false,
}) {}
export class HotelDto {
  @Text(1, 150) name!: string;
  @Text(1, 300) address!: string;
  @Text(1, 80) city!: string;
  @Text(2, 2) country!: string;
  @Text(0, 10000) description!: string;
  @Num(1, 5, true) starClass!: number;
  @ListStrings(50) @MaxLength(100, { each: true }) amenities!: string[];
  @Text(1, 80) timezone!: string;
}
export class PatchHotelDto extends PartialType(HotelDto, {
  skipNullProperties: false,
}) {}
export class TierDto {
  @Num(0, 3650, true) threshold!: number;
  @Num(0, 100) refundPercent!: number;
}
export class CancellationPolicyDto {
  @ApiProperty({ type: [TierDto] })
  @IsArray()
  @ArrayMaxSize(30)
  @ValidateNested({ each: true })
  @Type(() => TierDto)
  tiers!: TierDto[];
}
export class BaggageDto {
  @Num(0.01) extraBagPrice!: number;
  @Num(0, 20, true) maxExtraBags!: number;
}
export class HotelPolicyDto extends CancellationPolicyDto {
  @Text(5, 5) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) checkInTime!: string;
  @Text(5, 5) @Matches(/^([01]\d|2[0-3]):[0-5]\d$/) checkOutTime!: string;
}
export class FlightDto {
  @Text(1, 20) flightNumber!: string;
  @Text(3, 3) departureAirport!: string;
  @Text(3, 3) arrivalAirport!: string;
  @Text(16, 19) departureLocal!: string;
  @Text(16, 19) arrivalLocal!: string;
}
export class CreateFlightDto extends FlightDto {
  @Id() airlineId!: string;
}
export class PatchFlightDto extends PartialType(FlightDto, {
  skipNullProperties: false,
}) {}
export const CABINS = ["Economy", "Premium Economy", "Business", "First"];
export class CabinDto {
  @Choice(CABINS) category!: string;
  @Num(1, 1000, true) capacity!: number;
  @Num(0.01) price!: number;
  @Num(0, 10, true) freeBags!: number;
  @Num(0.01, 100) bagWeightKg!: number;
}
export class PatchCabinDto extends PartialType(CabinDto, {
  skipNullProperties: false,
}) {}
export class FlightSearchDto extends PageDto {
  @Text(3, 3) departureAirport!: string;
  @Text(3, 3) arrivalAirport!: string;
  @DateField() departureDate!: string;
  @DateField(true) returnDate?: string;
  @Num(1, 1000, true, true) adults = 1;
  @Num(0, 1000, true, true) children = 0;
  @Num(0, 1000, true, true) infants = 0;
  @Choice(CABINS, true) cabin?: string;
  @Num(0, 1e8, false, true) minPrice?: number;
  @Num(0, 1e8, false, true) maxPrice?: number;
  @Choice(["price", "duration", "departure"], true) sort = "price";
}
export class PassengerDto {
  @Text(1, 150) fullName!: string;
  @DateField() dateOfBirth!: string;
  @Text(1, 50) identityNumber!: string;
  @Choice(["adult", "child", "infant"]) type!: string;
  @Num(0, 20, true, true) extraBags = 0;
  @ApiProperty({ type: [Number], required: false })
  @OptionalField()
  @IsArray()
  @ArrayMaxSize(20)
  @IsNumber({}, { each: true })
  @Min(0, { each: true })
  bagWeightsKg?: number[];
}
export class SegmentDto {
  @Id() flightId!: string;
  @Choice(CABINS) cabin!: string;
}
export class FlightBookingDto {
  @ApiProperty({ type: [SegmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => SegmentDto)
  segments!: SegmentDto[];
  @ApiProperty({ type: [PassengerDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2000)
  @ValidateNested({ each: true })
  @Type(() => PassengerDto)
  passengers!: PassengerDto[];
}
export class FlightChangeDto {
  @ApiProperty({ type: [SegmentDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(2)
  @ValidateNested({ each: true })
  @Type(() => SegmentDto)
  segments!: SegmentDto[];
}
export class RoomDto {
  @Text(1, 40) number!: string;
  @Text(1, 80) type!: string;
  @Num(1, 30, true) beds!: number;
  @Num(1, 50, true) occupancy!: number;
  @Num(0.01) price!: number;
}
export class PatchRoomDto extends PartialType(RoomDto, {
  skipNullProperties: false,
}) {
  @ApiProperty({ required: false })
  @OptionalField()
  @IsBoolean()
  active?: boolean;
}
export class RangeDto {
  @DateField() start!: string;
  @DateField() end!: string;
}
export class AvailabilityDto {
  @Choice(["availability", "blocked"]) kind!: string;
  @ApiProperty({ type: [RangeDto] })
  @IsArray()
  @ArrayMaxSize(100)
  @ValidateNested({ each: true })
  @Type(() => RangeDto)
  ranges!: RangeDto[];
}
export class HotelSearchDto extends PageDto {
  @Text(1, 100) destination!: string;
  @DateField() checkIn!: string;
  @DateField() checkOut!: string;
  @Num(1, 100, true, true) guests = 1;
  @Num(1, 20, true, true) rooms = 1;
  @Num(0, 1e8, false, true) minPrice?: number;
  @Num(0, 1e8, false, true) maxPrice?: number;
  @Num(1, 5, false, true) minRating?: number;
  @Choice(["price", "rating"], true) sort = "price";
}
export class StayQueryDto {
  @DateField() checkIn!: string;
  @DateField() checkOut!: string;
}
export class OptionalStayQueryDto extends PartialType(StayQueryDto, {
  skipNullProperties: false,
}) {}
export class StayPageQueryDto extends StayQueryDto {
  @Num(1, 1e6, true, true) page = 1;
}
export class RangePageQueryDto extends RangeDto {
  @Num(1, 1e6, true, true) page = 1;
}
export class OccupantDto {
  @Text(1, 100) name!: string;
  @Num(0, 120, true) age!: number;
}
export class SelectedRoomDto {
  @Id() roomId!: string;
  @ApiProperty({ type: [OccupantDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => OccupantDto)
  guests!: OccupantDto[];
}
export class HotelBookingDto extends StayQueryDto {
  @Id() hotelId!: string;
  @ApiProperty({ type: [SelectedRoomDto] })
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SelectedRoomDto)
  rooms!: SelectedRoomDto[];
}
export class PaymentDto {
  @Choice(["flight", "hotel"]) type!: string;
  @Id() bookingId!: string;
}
export class ReviewDto {
  @Num(1, 5, true) rating!: number;
  @Text(0, 1000, true) body?: string;
}
export class PatchReviewDto extends PartialType(ReviewDto, {
  skipNullProperties: false,
}) {}
export class ReplyDto {
  @Text(1, 1000) body!: string;
}
export class ItineraryDto {
  @Text(1, 100) title!: string;
  @ListStrings(50, false, 1) countries!: string[];
  @DateField() startDate!: string;
}
export class PatchItineraryDto extends PartialType(ItineraryDto, {
  skipNullProperties: false,
}) {
  @Choice(["Private", "Public"], true) visibility?: string;
}
export class DayDto {
  @Text(1, 80) city!: string;
  @Text(0, 10000, true) notes?: string;
}
export class PatchDayDto extends PartialType(DayDto, {
  skipNullProperties: false,
}) {}
export class ReorderDto {
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(60)
  @ArrayUnique()
  @IsMongoId({ each: true })
  dayIds!: string[];
}
export class ActivityDto {
  @Text(1, 150) name!: string;
  @Text(0, 10000, true) description?: string;
  // An empty value clears the time when an activity becomes unscheduled.
  @Text(0, 5, true)
  @Matches(/^(?:([01]\d|2[0-3]):[0-5]\d)?$/, { message: "Use HH:mm or leave time empty" })
  time?: string;
  @Num(0, 1e8, false, true) cost?: number;
  @Currency(true) currency?: string;
}
export class PatchActivityDto extends PartialType(ActivityDto, {
  skipNullProperties: false,
}) {}
export class BudgetDto {
  @Choice(["Food", "Accommodation", "InCityTransport", "Activities"])
  category!: string;
  @Num() amount!: number;
  @Currency() currency!: string;
}
export class PatchBudgetDto extends PartialType(BudgetDto, {
  skipNullProperties: false,
}) {}
export class TransportDto {
  @Text(1, 100) mode!: string;
  @Text(1, 80) fromCity!: string;
  @Text(1, 80) toCity!: string;
  @Num() amount!: number;
  @Currency() currency!: string;
  @Id() dayId!: string;
}
export class PatchTransportDto extends PartialType(TransportDto, {
  skipNullProperties: false,
}) {}
export class PublicItineraryQueryDto extends PageDto {
  @Text(0, 100, true) q?: string;
  @Text(1, 80, true) country?: string;
  @Text(1, 80, true) city?: string;
  @Num(0, 60, true, true) minDays?: number;
  @Num(0, 60, true, true) maxDays?: number;
}
export class ItineraryHotelQueryDto extends PageDto {
  @Id() firstDayId!: string;
  @Num(1, 100, true) guests!: number;
  @Num(1, 20, true, true) rooms = 1;
}
export class ItineraryFlightQueryDto extends PageDto {
  @Choice(["one-way", "round-trip"], true)
  tripType: string = "one-way";
  @Text(3, 3) origin!: string;
  @DateField(true) departureDate?: string;
  @DateField(true) returnDate?: string;
  @Num(1, 1000, true, true) adults = 1;
  @Num(0, 1000, true, true) children = 0;
  @Num(0, 1000, true, true) infants = 0;
}
export class BookingLinkDto {
  @Id() bookingId!: string;
  @Id() dayId!: string;
}
export class PostDto {
  @Text(1, 200) title!: string;
  @Text(1, 100000) body!: string;
  @ListStrings(5, true)
  @MaxLength(30, { each: true })
  @MinLength(1, { each: true })
  tags?: string[];
  @Choice(["Draft", "Published"], true) status?: string;
}
export class PatchPostDto extends PartialType(PostDto, {
  skipNullProperties: false,
}) {}
export class PostQueryDto extends PageDto {
  @Text(0, 100, true) q?: string;
  @Text(1, 30, true) tag?: string;
}
export class CommentDto {
  @Text(1, 500) body!: string;
}
export class ReportDto {
  @Choice(["post", "comment", "review", "itinerary"]) contentType!: string;
  @Id() contentId!: string;
  @Text(1, 1000) reason!: string;
}
export class ResolveReportDto {
  @Choice(["dismiss", "hide", "delete"]) action!: string;
}
export class HideContentDto {
  @ApiProperty() @IsBoolean() hidden!: boolean;
}
export class AttachItineraryDto {
  @Id(true) itineraryId?: string;
}
export class FavouriteDto {
  @Choice(["hotel", "itinerary"]) type!: string;
  @Id() resourceId!: string;
}
export class SeatSelectionDto {
  @Id() flightId!: string;
  @ApiProperty({ type: [String] })
  @IsArray()
  @ArrayMaxSize(1000)
  @IsString({ each: true })
  @MaxLength(10, { each: true })
  labels!: string[];
}
export class AnalyticsDto extends PageDto {
  @DateField() from!: string;
  @DateField() to!: string;
}
