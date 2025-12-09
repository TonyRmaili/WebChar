import { create } from "zustand";

const initialChar = {
  ac: 0,
  max_hp: 0,
  speed: 0,
  pb: 2,
};

const savedCharData = JSON.parse(localStorage.getItem("charData") || "null");

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
  charData: savedCharData || initialChar,
  setCharData: (data) => {
    const newData = data ?? initialChar;
    localStorage.setItem("charData", JSON.stringify(newData));
    set({ charData: newData });
  },

  updateCharField: (key, value) =>
    set((state) => {
      const updated = {
        ...(state.charData ?? initialChar),
        [key]: value,
      };
      localStorage.setItem("charData", JSON.stringify(updated));
      return { charData: updated };
    }),
  

    
  postCharData: async () => {
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


  toggleActiveChar: async (char_id) => {
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`http://localhost:8000/character/${char_id}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
        },
      })
      if (!res.ok) throw new Error(`Toggle failed: ${res.status}`)
      // Pull fresh user data
      
    } catch (e) {
      console.error(e)
      alert('Could not toggle active state.')
    }
  },

  createChar: async (name) => {
    try {
      const token = localStorage.getItem("token");
      

      if (!token) {
        throw new Error("Token not found in localStorage");
      }
      
      const response = await fetch("http://localhost:8000/character", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({ name }),  

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

  fetchChar: async (char_id) => {
    const { setCharData } = get();
    const token = localStorage.getItem("token");
    
    try {
      const response = await fetch(`http://localhost:8000/character/file/${char_id}`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        
      });
      if (response.status === 200) {
        const charData = await response.json();
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


  createQuickClass: async (prompt) => {
    try {
      const token = localStorage.getItem("token");
      

      if (!token) {
        throw new Error("Token not found in localStorage");
      }
      
      const response = await fetch("http://localhost:8000/quick_class", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify(prompt),  

      });

    
      if (!response.ok) {
        throw new Error("Failed to post QuickClass to the endpoint");
      }

      // Optionally, handle the response if needed
      const responseData = await response.json();
      console.log("QuickClass posted successfully:", responseData);
      return responseData

      
    } catch (error) {
      console.error("Error posting QuickClass:", error.message);
    }
  },


  


}));

export default useCharStore;
