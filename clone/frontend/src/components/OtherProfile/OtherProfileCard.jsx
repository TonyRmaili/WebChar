import React from 'react';

function OtherProfileCard( {otherUserData}) {
    
    return (
        <div className="flex flex-col p-4 ">
            <img src="https://source.unsplash.com/200x200/?portrait?2" alt="" className="flex-shrink-0 object-cover h-64 rounded-sm sm:h-60 dark:bg-gray-500 aspect-square" />
            <div>
                {otherUserData ? (
                    <h2 className="text-xl font-semibold mt-2">
                        {otherUserData?.user_name}
                    </h2>
                ) : null}
                <span className="block pb-2 text-sm dark:text-white">Memeber since: {otherUserData?.member_since}</span>
                <p>{otherUserData && otherUserData.posts && otherUserData.posts.length > 0 ? otherUserData.posts[otherUserData.posts.length - 1].text : "His thoughts...."}</p>

            </div>
        </div>
    )
}

export default OtherProfileCard