export interface Product {
  source?: string;
  likes?: number;
  createdAt?: number;
  tryOnEnabled?: boolean;
  tryOnPrice?: number;
  id: string;
  name: string;
  price: number;
  image: string;
  category: string;
  gender: "men" | "women";
  rating: number;
  description: string;
}

export interface CartItem extends Product {
  quantity: number;
}

export interface UserData {
  uid: string;
  email: string;
  displayName?: string;
  photoURL?: string;
  subscription?: {
    plan: string;
    expiresAt: string;
    tryonsRemaining: number;
  };
}

export type Page =
  "home" | "shopping" | "tryon" | "sketch" | "subscription" | "cart" | "login";
