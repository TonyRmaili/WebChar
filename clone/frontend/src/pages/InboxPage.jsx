import React, { useEffect, useState } from "react";
import useAuthStore from "../stores/store";

function InboxPage() {
  const { userData, fetchUser } = useAuthStore();
  const [newMessages, setNewMessages] = useState({}); // State to hold the new message content for each sender/receiver

//   useEffect(() => {
//     console.log(userData);
//   }, [userData]);

const handleSendMessage = (text) => {
    const formData = new FormData();
    formData.append('sender_id', userData.id);
    const entries = Object.entries(text);
  
    entries.forEach(([key, value]) => {
      // Use unary plus operator (+) or Number() function to convert key to number
      formData.append('receiver_id', key);
      formData.append('text', value);
    });
    sendMessage(formData)
    
};

  

  const sendMessage = async (text) => {
    const formData = new FormData();
    formData.append('sender_id', userData.id);
    const entries = Object.entries(text);
  
    entries.forEach(([key, value]) => {
      // Use unary plus operator (+) or Number() function to convert key to number
      formData.append('receiver_id', key);
      formData.append('text', value);
    });
    try {
      const response = await fetch("http://localhost:8000/messages", {
        method: 'POST',
       
        body: formData
      });
  
      if (!response.ok) {
        throw new Error('Failed to send message');
      }
  
      // Message sent successfully
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Error sending message:', error.message);
    }
  };
  

  // Group sent messages by sender_id
  const sentMessagesBySender = userData.sent_messages.reduce((acc, message) => {
    if (!acc[message.receiver_id]) {
      acc[message.receiver_id] = [];
    }
    acc[message.receiver_id].push(message);
    return acc;
  }, {});

  // Group received messages by sender_id
  const receivedMessagesBySender = userData.received_messages.reduce((acc, message) => {
    if (!acc[message.sender_id]) {
      acc[message.sender_id] = [];
    }
    acc[message.sender_id].push(message);
    return acc;
  }, {});

  return (
    <div className="container mx-auto px-4">
      <h1 className="text-center text-3xl font-semibold mb-8">Inbox</h1>

      {/* Sent Messages */}
      <div className="mb-8">
        <h2 className="text-xl font-semibold mb-4">Sent Messages</h2>
        {Object.keys(sentMessagesBySender).map((senderId) => (
          <div key={senderId} className="border border-gray-200 p-4 rounded-lg mb-4">
            <h3 className="text-lg font-semibold">Sent to User: {senderId}</h3>
            {sentMessagesBySender[senderId].map((message, index) => (
              <div key={index} className="mt-2">
                <p className="text-gray-800">{message.text}</p>
              </div>
            ))}
            {/* Textarea for composing new message */}
            <div className="mt-4">
              <textarea
                value={newMessages[senderId] || ""}
                onChange={(e) => setNewMessages({ ...newMessages, [senderId]: e.target.value })}
                className="border border-gray-300 p-2 rounded w-full"
                placeholder="Type your message here..."
              ></textarea>
              <button
                 onClick={()=> sendMessage(newMessages)}
                className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded mt-2"
              >
                Send
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Received Messages */}
      <div>
        <h2 className="text-xl font-semibold mb-4">Received Messages</h2>
        {Object.keys(receivedMessagesBySender).map((senderId) => (
          <div key={senderId} className="border border-gray-200 p-4 rounded-lg mb-4">
            <h3 className="text-lg font-semibold">Received from User: {senderId}</h3>
            {receivedMessagesBySender[senderId].map((message, index) => (
              <div key={index} className="mt-2">
                <p className="text-gray-800">{message.text}</p>
              </div>
            ))}
          </div>
        ))}
      </div>

      
      <div className="flex justify-center mt-8">
        <button
          onClick={fetchUser}
          className="bg-blue-500 hover:bg-blue-700 text-white font-bold py-2 px-4 rounded"
        >
          Update
        </button>
      </div>
    </div>
  );
}

export default InboxPage;
