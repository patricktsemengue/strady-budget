export let currentUserId = null;

export const setStorageUser = (userId) => {
    currentUserId = userId;
};

// Removed localStorage caching functions as per user request to use Firestore directly and avoid slowdowns.
