import { create } from "zustand";

const loadInitialState = () => {
  const charData = JSON.parse(localStorage.getItem("charData")) || null;

  if (localStorage.userData) {
    charData.user_id = JSON.parse(localStorage.userData).id; // Store userData.id as user_id within charData
  }
  return { charData };
};

const useCharStore = create((set, get) => ({
  ...loadInitialState(),
  
  setCharData: (charData) => {
    localStorage.setItem("charData", JSON.stringify(charData)); // Save the user data to localStorage
    set(() => ({ charData }));
  },
  postCharData: async () => {
    try {
      const token = localStorage.getItem("token");
      const charData = localStorage.getItem("charData")
      

      if (!token) {
        throw new Error("Token not found in localStorage");
      }
      
      const response = await fetch("http://localhost:8000/create_char", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: charData
      });

      if (!response.ok) {
        throw new Error("Failed to post charData to the endpoint");
      }

      // Optionally, handle the response if needed
      const responseData = await response.json();
      console.log("CharData posted successfully:", responseData);
    } catch (error) {
      console.error("Error posting charData:", error.message);
    }
  },
}));

export default useCharStore;
