import { Stack } from "expo-router";
import { Slot } from "expo-router";

// Make this a simple pass-through, as we're using a flat route structure now
export default function AuthLayout() {
  return <Slot />;
}
