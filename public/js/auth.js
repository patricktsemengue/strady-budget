import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { 
    getAuth, 
    onAuthStateChanged, 
    signInWithPopup, 
    GoogleAuthProvider, 
    signOut 
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
import { firebaseConfig } from "./firebase-config.js";

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

export const login = async () => {
    try {
        const result = await signInWithPopup(auth, provider);
        // Check if this is a new user using the _tokenResponse internal property
        if (result._tokenResponse?.isNewUser) {
            sessionStorage.setItem('strady_is_new_user_session', 'true');
        }
        return result.user;
    } catch (error) {
        console.error("Login error:", error);
        throw error;
    }
};

export const logout = async () => {
    try {
        await signOut(auth);
    } catch (error) {
        console.error("Logout error:", error);
        throw error;
    }
};

export const onUserChanged = (callback) => {
    onAuthStateChanged(auth, callback);
};

export { auth };
