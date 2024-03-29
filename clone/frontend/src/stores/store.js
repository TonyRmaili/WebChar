import { create } from "zustand";

const loadInitialState = () => {
  const token = localStorage.getItem("token") || null;
  const userData = JSON.parse(localStorage.getItem("userData")) || null;
  const petData = JSON.parse(localStorage.getItem("petData")) || null;
  const postData = JSON.parse(localStorage.getItem("postData")) || null;

  // Attempt to parse the user data from localStorage or set to null if not found
  return { token: token, userData, petData, postData };
};

const useAuthStore = create((set, get) => ({
  ...loadInitialState(),
  setToken: (token) => {
    localStorage.setItem("token", token); // Save the token to localStorage
    set(() => ({ token }));
  },
  logout: () => {
    localStorage.removeItem("token"); // Ensure to clear all localStorage on logout
    localStorage.removeItem("userData"); // Ensure to clear all localStorage on logout
    localStorage.removeItem("petData");
    localStorage.removeItem("postData");
    set(() => ({ token: null, userData: null, petData: null }));

  {/* logout: () => {
    localStorage.clear();
    set(() => ({ token: null, userData: null, petData: null }));
},*/}
  },
  setUserData: (userData) => {
    localStorage.setItem("userData", JSON.stringify(userData)); // Save the user data to localStorage
    set(() => ({ userData }));
  },
  setPetData: (petData) => {
    localStorage.setItem("petData", JSON.stringify(petData)); 
    set(() => ({ petData }));
  },
  setPostData: (postData) => {
    localStorage.setItem("postData", JSON.stringify(postData)); 
    set(() => ({ postData }));
  },


  fetchUser: async () => {
    const { token, logout, setUserData } = get(); // Accessing current state and actions
    try {
      const response = await fetch("http://localhost:8000/me", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.status === 200) {
        const userData = await response.json();
        // console.log(userData)
        setUserData(userData);
      } else if (response.status === 401) {
        logout();
        // You might need to handle navigation to /login outside this store, as Zustand doesn't manage routing
      } else {
        console.error("Failed to fetch user data");
      }
    } catch (error) {
      console.error("There was an error fetching user data:", error);
      // Handle error as needed
    }
  },
  fetchPet: async () => {
    const { token, logout, setPetData } = get();
    try {
      const response = await fetch("http://localhost:8000/pet", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.status === 200) {
        const petData = await response.json();
        // console.log(petData)
        setPetData(petData);
      } else if (response.status === 401) {
        logout();
        
      } else {
        console.error("Failed to fetch pet data");
      }
    } catch (error) {
      console.error("There was an error fetching pet data:", error);
      // Handle error as needed
    }
  },
  fetchPost: async () => {
    const { token, logout, setPostData } = get();
    try {
      const response = await fetch("http://localhost:8000/post", {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.status === 200) {
        const postData = await response.json();
        console.log(postData)
        setPostData(postData);
      } else if (response.status === 401) {
        logout();
        // You might need to handle navigation to /login outside this store, as Zustand doesn't manage routing
      } else {
        console.error("Failed to fetch post data");
      }
    } catch (error) {
      console.error("There was an error fetching post data:", error);
      // Handle error as needed
    }
  }
}));

export default useAuthStore;
