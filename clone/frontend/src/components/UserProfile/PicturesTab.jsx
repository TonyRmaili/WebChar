import React, { useEffect, useState } from 'react'
import useAuthStore from '../../stores/store'
import { useNavigate } from "react-router-dom";

export default function UserPictures() {
  const [selectedImage, setSelectedImage] = useState()
  const { token, userData } = useAuthStore();
  const navigate = useNavigate()


  async function uploadImg() {
    // needed?
    if (!token) {
      console.error('User is not authenticated');
      navigate("/login")
      return;
    }

    try {
      const formData = new FormData();
      formData.append('userPic', selectedImage);
      const response = await fetch("http://localhost:8000/user/upload_image", {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`
        },
        body: formData
      });

      if (response.status === 200) {
        const data = await response.json();


      } else if (response.status === 400 || response.status === 401) {
        const data = await response.json();
        setServerError(data.detail); // Set server error based on the response
        console.log(data.detail)
      } else {
        console.log("Upload Failed", response);
        setServerError(
          "An unexpected error occurred. Please try again later."
        );
      }
    } catch (error) { }
  }

  useEffect(() => {
    if (selectedImage) {
      uploadImg();
    }
  }, [selectedImage]);


  const handleImageChange = (event) => {
    const image = event.target.files[0];
    setSelectedImage(image);
  };

  return (
    <div className='mt-4'>
      <div className="flex justify-center">
        <div className="relative overflow-hidden inline-block p-2 mb-4 text-xl">
          <input type="file" name="userPic" id="userPic" onChange={handleImageChange} className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
          <label htmlFor="userPic" className="bg-green-500 text-white px-4 py-2 rounded cursor-pointer">Choose a file</label>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          {userData.pictures[0] ? (
            <img src={`${userData.pictures[0].file_path}`} alt="" />
          ) : (
            <img className="h-auto max-w-full rounded-lg"
              src="https://flowbite.s3.amazonaws.com/docs/gallery/square/image-1.jpg" alt=""></img>
          )}
        </div>
        <div>
          <img className="h-auto max-w-full rounded-lg"
            src="https://flowbite.s3.amazonaws.com/docs/gallery/square/image-2.jpg" alt=""></img>
        </div>
        <div>
          <img className="h-auto max-w-full rounded-lg"
            src="https://flowbite.s3.amazonaws.com/docs/gallery/square/image-3.jpg" alt=""></img>
        </div>
        <div>
          <img className="h-auto max-w-full rounded-lg"
            src="https://flowbite.s3.amazonaws.com/docs/gallery/square/image-4.jpg" alt=""></img>
        </div>
      </div>
    </div>
  )
}
