import React, { useEffect, useState } from 'react';
import useAuthStore from '../../stores/store';

function ProfileCard() {
    const { token, userData, fetchUser, postData, fetchPost } = useAuthStore();
    const [text, setText] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);

    useEffect(() => {
        if (token) {
            fetchUser();
            fetchPost()
        }
    }, [token, fetchUser]);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setLoading(true);
        
        const newPostData = { 
            date: new Date().toISOString(),
            user_id: userData.id,
            text: text
        }
        console.log(newPostData)
        try {
            const response = await fetch("http://localhost:8000/post", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    Authorization: `Bearer ${token}`,
                },
                body: JSON.stringify( newPostData ),
            });
            if (response.ok) {
                console.log("New text created successfully");
                // Optionally, refetch user data after successful submission
                fetchUser();
            } else {
                console.error("Error submitting new text");
                setError("Error submitting new text");
            }
        } catch (error) {
            console.error("Error:", error);
            setError("Error: " + error.message);
        } finally {
            setLoading(false);
        }
    };
        const handleReset = () => {
            setText(''); // Reset the text state
    };

return (
    <div className="flex flex-col p-4 ">
        <img src="https://source.unsplash.com/200x200/?portrait?2" alt="" className="flex-shrink-0 object-cover h-64 rounded-sm sm:h-60 dark:bg-gray-500 aspect-square" />
        <div>
            {userData ? (
                <h2 className="text-xl font-semibold mt-2">
                    {userData?.user_name}
                </h2>
            ) : null}
            <span className="block pb-2 text-sm dark:text-white">Memeber since: <br /> {userData?.member_since}</span>
            <form method="post" onSubmit={handleSubmit}>
                <textarea
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    rows="4"
                    className="block p-2 mb-2 w-full text-sm text-gray-900 bg-gray-50 rounded-lg border border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:bg-gray-500 dark:border-gray-600 dark:placeholder-gray-400 dark:text-white dark:focus:ring-blue-500 dark:focus:border-blue-500"
                    placeholder={postData && postData.length !== 0 ? `${postData[postData.length - 1].text}` : "Your thoughts...."}>
                </textarea>
                {error && <div className="text-red-500">{error}</div>}
                <hr />
                <div className='flex justify-between mt-2'>
                    <button className='border p-1' onClick={handleReset} type="reset" disabled={loading}>Reset </button>
                    <button className='border p-1' type="submit" disabled={loading}>Save </button>
                </div>
            </form>
        </div>
    </div>
)
}

export default ProfileCard