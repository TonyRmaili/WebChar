import { create } from "zustand";

const API_BASE = "http://localhost:8000"

const loadInitialState = () => {
  
  const token = localStorage.getItem("token") || null;
  const userData = JSON.parse(localStorage.getItem("userData")) || null;
  const charData = JSON.parse(localStorage.getItem("charData")) || null;
  const partyData = JSON.parse(localStorage.getItem("partyData")) || null;

  const busy = false;
  const error = "";

  // Attempt to parse the user data from localStorage or set to null if not found
  return { token, userData, charData, partyData, busy, error };
};

const useAuthStore = create((set, get) => ({
  ...loadInitialState(),
  setToken: (token) => {
    localStorage.setItem("token", token); // Save the token to localStorage
    set(() => ({ token }));
  },

  logout: () => {
    // Ensure to clear all localStorage on logout
    localStorage.removeItem("token"); 
    localStorage.removeItem("userData"); 
    localStorage.removeItem("charData"); 
    localStorage.removeItem("partyData"); 
    localStorage.removeItem("minionsData"); 
    
    set(() => ({ token: null, userData: null, charData: null, partyData: null}));
  },

  setUserData: (userData) => {
    localStorage.setItem("userData", JSON.stringify(userData)); // Save the user data to localStorage
    set(() => ({ userData }));
  },

  setBusy: (busy) => set({ busy }),
  setError: (error) => set({ error }),

  fetchUser: async () => {
    const { token, logout, setUserData } = get(); // Accessing current state and actions
    try {
      const response = await fetch(`${API_BASE}/me`, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
      });
      if (response.status === 200) {
        const userData = await response.json();
        setUserData(userData);
       
      } else if (response.status === 401) {
        logout();
      } else {
        console.error("Failed to fetch user data");
      }
    } catch (error) {
      console.error("There was an error fetching user data:", error);
      // Handle error as needed
    }
  },

  createAccount: async (formData) => {
    const { setError, setBusy } = get();

    setError("");
    setBusy(true);

    try {
      const response = await fetch(`${API_BASE}/create_account`, { 
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(formData),
      });
      if (response.ok) {

        console.log('Account created successfully');
        return true

      } else {
        console.error('Error creating account');
        setError("Couldn't create the account — that name may be taken.");
      }
    } catch (error) {
      console.error('Error:', error);
      setError("Can't reach the server.");
    } finally {
      setBusy(false);
    }
  },

  deleteAccount: async() => {
    const { token, logout } = get();

    await fetch(`${API_BASE}/delete_account`, {
      method: "DELETE",
      headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      credentials: "include",
    });
    logout();

  },

  logIn: async(name,password) => {

    const { setError, setBusy, setToken, fetchUser } = get();

    setError("");
    setBusy(true);

    const formData = new FormData();
    formData.append("username", name) 
    formData.append("password", password)
    
    try {
      const response = await fetch(`${API_BASE}/login`, {
        method: "POST",
        body: formData
      });
       
      if (response.status === 200) {
        console.log("login success!")
        const data = await response.json();
        setToken(data.access_token)
        await fetchUser()

        return true
       
    
      } else if (response.status === 400 || response.status === 401) {
        const data = await response.json();
        console.log(data)
        setError("That name and secret phrase don't match.");
      } else {
        console.log("Login Failed");
        setError("Log in failed — try again.");
      }
    } catch (error) {
      setError("Can't reach the server.");
    } finally {
      setBusy(false);
    }
  }


  
}));

export default useAuthStore;
