import { create } from "zustand";

const loadInitialState = () => {
  const charData = JSON.parse(localStorage.getItem("charData")) || null;
  const userData = JSON.parse(localStorage.getItem("userData")) || null;
  if (userData && userData.id && charData) {
    charData.user_id = userData.id; 
  }

  return { charData };
};


const useCombatStore = create((set, get) => ({
  ...loadInitialState(),

    

  healthChange: async () => {
  try {
    const token = localStorage.getItem("token");
    if (!token) throw new Error("Token not found in localStorage");

    const raw = localStorage.getItem("charData");
    if (!raw) throw new Error("No charData in localStorage");

    const charData = JSON.parse(raw); // make it an object

    const response = await fetch("http://localhost:8000/update_character", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      // match the DictData(form_data: dict) shape:
      body: JSON.stringify(charData),
    });

    // Read the body ONCE:
    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      // surface FastAPI error details if present
      throw new Error(
        `Failed: ${response.status} ${payload ? JSON.stringify(payload) : ""}`
      );
    }

    console.log("CharData posted successfully:", payload);
  } catch (error) {
    console.error("Error updating charData:", error.message);
  }
},



}));

export default useCombatStore;
