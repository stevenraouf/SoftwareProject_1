"use client";
import { FlightSearch, FlightDetail } from "./flights";
import { StaySearch, HotelDetail } from "./stays";
import { MyTrips, BookingDetail, ChangeDetail } from "./trips";
import "./booking.css";

export default function BookingFeature({
  view,
  id,
}: {
  view: string;
  id?: string;
}) {
  switch (view) {
    case "flights":
      return <FlightSearch />;
    case "stays":
      return <StaySearch />;
    case "flight":
      return id ? <FlightDetail key={id} id={id} /> : <FlightSearch />;
    case "hotel":
      return id ? <HotelDetail key={id} id={id} /> : <StaySearch />;
    case "booking":
      return id ? <BookingDetail key={id} id={id} /> : <MyTrips />;
    case "change":
      return id ? <ChangeDetail key={id} id={id} /> : <MyTrips />;
    case "trips":
      return <MyTrips />;
    default:
      return null;
  }
}
