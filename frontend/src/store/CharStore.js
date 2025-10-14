import { create } from "zustand";

const loadInitialState = () => {
  const charData = JSON.parse(localStorage.getItem("charData")) || null;
  const userData = JSON.parse(localStorage.getItem("userData")) || null;
  
  if (userData && userData.id && charData) {
    charData.user_id = userData.id; 
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
      
      const response = await fetch("http://localhost:8000/character", {
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

  deleteChar: async (char_name) => {
    try {
      const token = localStorage.getItem("token");

      if (!token) {
        throw new Error("Token not found in localStorage");
      }

      const response = await fetch(`http://localhost:8000/character/${char_name}`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/string",
          "Authorization": `Bearer ${token}`
        },
        body: char_name
      });

      if (!response.ok) {
        throw new Error("Failed to delete character");
      }


      console.log(`Deleting ${char_name}`)
    }
    catch (error) {
      console.error("Error deleting character:", error.message);
    }
  },

  fetchChar: async () => {
    const { setCharData } = get();
    const token = localStorage.getItem("token");
    
    try {
      const response = await fetch("http://localhost:8000/character/user_characters", {
        method: "GET",
        headers: {
          "Content-Type": "application/text",
          "Authorization": `Bearer ${token}`
        },
        
      });
      if (response.status === 200) {
        const charData = await response.text();
        setCharData(charData);
        
      } else if (response.status === 401) {
       
      } else {
        console.error("Failed to fetch user data");
      }
    } catch (error) {
      console.error("There was an error fetching user data:", error);
      // Handle error as needed
    }
  },



  fetchAllChars: async () => {
    const { setCharData } = get();
    const token = localStorage.getItem("token");
    
    try {
      const response = await fetch("http://localhost:8000/character", {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        
      });
      if (response.status === 200) {
        const charData = await response.json();
        
      } else if (response.status === 401) {
       
      } else {
        console.error("Failed to fetch all characters data");
      }
    } catch (error) {
      console.error("There was an error fetching user data:", error);
      // Handle error as needed
    }
  },


}));

export default useCharStore;
