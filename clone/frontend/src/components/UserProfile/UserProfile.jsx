import React, { useState, useRef, useEffect } from 'react';
import Gallery from './Gallery'
import Listings from './Listings'
import PicturesTab from './PicturesTab'
import ShortcutTab from './ShortcutTab';
import ProfileCard from "./ProfileCard"
import CreateTab from "./CreateTab"
import SettingsTab from './SettingsTab';
import PetsTab from './PetsTab';


// import { useNavigate } from 'react-router-dom';
// import useAuthStore from '../../stores/store';

const tabs = [
    { name: 'About', id: 0 },
    { name: 'Pets', id: 1 },
    { name: 'Create', id: 2 },
    { name: 'Pictures', id: 3 },
    { name: 'Settings', id: 4 }
];

function UserProfile() {
    const [activeTab, setActiveTab] = useState(tabs[0]);

    const handleTabSelect = (tab) => {
        setActiveTab(tab);
    };

    return (
        <div className='justify-center items-center mx-auto w-1/2 min-h-screen mb-2'>
            <div className='mt-2 h-14'>
                <ShortcutTab
                    tabs={tabs}
                    selectedTab={activeTab}
                    onSelect={handleTabSelect}
                />
            </div>
            <div className='flex min-h-screen'>
                <div className='border border-black w-1/3 min-h-screen bg-gray-400 p-2'>
                    <div className='mt-2 mr-2 ml-2'>
                        <ProfileCard />
                    </div>
                    <div className='h-60 w-72 mx-auto mt-10'>
                        <Gallery />
                    </div>
                </div>
                <div className='w-2/3 min-h-screen p-2 bg-gray-600'>
                    {activeTab.name === 'About' && <Listings />}
                    {activeTab.name === 'Pets' && <PetsTab />}
                    {activeTab.name === 'Pictures' && <PicturesTab />}
                    {activeTab.name === 'Create' && <CreateTab />}
                    {activeTab.name === 'Settings' && <SettingsTab />}
                </div>
            </div>
        </div>
    );
}
export default UserProfile;
