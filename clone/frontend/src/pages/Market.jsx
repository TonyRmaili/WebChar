import React, { useState } from 'react'
import ListingCards from '../components/Market/ListingCards'
import Filter from '../components/Market/Filter'

function Market() {
    const [filterData, setFilterData] = useState(null);

    const handleFilterChange = (newFilterData) => {
      setFilterData(newFilterData);
    };

    return (
        <>
            <Filter onFilterChange={handleFilterChange} />
            <div className='justify-center items-center mx-auto w-full mb-2 mt-2 bg-gray-50 p-2'>
                <ListingCards filter={filterData} />
            </div>
        </>
    )
}

export default Market