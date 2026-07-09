/* =========================================================
   RIVALS — online configuration
   ---------------------------------------------------------
   To enable online play (shared head-to-head records + global
   leaderboard), deploy the backend in /server and put its URL here:

     export const API_BASE = "https://your-rivals-api.example.com";

   Leave it "" to run fully offline/static — challenge links then
   embed the moves in the URL and stats stay on each device.

   (You can also set window.RIVALS_API before the app loads to override.)
   ========================================================= */
export const API_BASE =
  (typeof window !== "undefined" && window.RIVALS_API) || "";
