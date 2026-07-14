import { auth, defineMcp } from "@lovable.dev/mcp-js";
import listRestaurants from "./tools/list-restaurants";
import getRestaurantMenu from "./tools/get-restaurant-menu";
import listMyOrders from "./tools/list-my-orders";
import getOrder from "./tools/get-order";
import cancelOrder from "./tools/cancel-order";

const projectRef = import.meta.env.VITE_SUPABASE_PROJECT_ID ?? "project-ref-unset";

export default defineMcp({
  name: "food-express-mcp",
  title: "FoodExpress",
  version: "0.1.0",
  instructions:
    "Tools for FoodExpress — a Pakistani food delivery app. Browse open restaurants, read menus, and manage the signed-in user's own orders. All reads are constrained by the user's role (customer / rider / restaurant owner / admin) and existing row-level security.",
  auth: auth.oauth.issuer({
    issuer: `https://${projectRef}.supabase.co/auth/v1`,
    acceptedAudiences: "authenticated",
  }),
  tools: [listRestaurants, getRestaurantMenu, listMyOrders, getOrder, cancelOrder],
});
