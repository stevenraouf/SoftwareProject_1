"use client";
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";
import { api, ApiError } from "./api";

export type User = {
  id: string;
  _id?: string;
  name: string;
  email: string;
  role: "User" | "Admin" | "AirlineModerator" | "HotelModerator";
  status: string;
  providerId?: string;
  registrationDate: string;
  phone?: string;
  preferredCurrency?: string;
  forcePasswordChange: boolean;
  emailVerified: boolean;
};
type Session = {
  user: User | null;
  loading: boolean;
  error: string;
  reload: () => Promise<void>;
};
const Context = createContext<Session>({
  user: null,
  loading: true,
  error: "",
  reload: async () => {},
});
export const useSession = () => useContext(Context);
export function SessionProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const reload = useCallback(async () => {
    try {
      setUser(await api<User>("/auth/me"));
      setError("");
    } catch (e) {
      setUser(null);
      setError(
        e instanceof ApiError && e.status === 401 ? "" : (e as Error).message,
      );
    } finally {
      setLoading(false);
    }
  }, []);
  useEffect(() => {
    void reload();
    const expired = () => setUser(null);
    window.addEventListener("aeris:expired", expired);
    return () => window.removeEventListener("aeris:expired", expired);
  }, [reload]);
  return (
    <Context.Provider value={{ user, loading, error, reload }}>
      {children}
    </Context.Provider>
  );
}
