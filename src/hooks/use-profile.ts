import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import axios from "axios";

interface User {
  id: string;
  name: string;
  email: string;
}

interface ProfileResponse {
  user: User;
}

async function getProfile() {
  const token = localStorage.getItem("token");

  const response = await axios.get<ProfileResponse>(
    "http://localhost:3333/me",
    {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    }
  );

  return response.data.user;
}

export function useProfile() {
  const [hasToken, setHasToken] = useState(false);

  useEffect(() => {
    setHasToken(!!localStorage.getItem("token"));
  }, []);

  return useQuery({
    queryKey: ["profile"],
    queryFn: getProfile,
    enabled: hasToken,
  });
}