import React, {useRef} from 'react'
import CreatableSelect from 'react-select/creatable'
function ReactSelect() {
    
    const options = [
        {value: 'jack',label:'Jack', color: "red"},
        {value: 's',label:'Ert',color: "blue"},
        {value: 'r',label:'Mo',color: "black"},
    ]

    const colorStyles = {
        
        control: (styles) => ({ ...styles,backgroundColor:"white"}),
        option: (styles, {data,isDisabled,isFocused, isSelected}) => {
            // console.log("option",data,isFocused,isDisabled,isSelected)
            return {...styles, color:data.color}
        },
        multiValue: (styles, {data}) =>{
            return {
                ...styles,
                backgroundColor:data.color,
                color:"#fff",
            }},
        multiValueLabel: (styles, {data}) =>{
            return{
                ...styles,
                color:"#fff"
                
            }
        },
        multiValueRemove: (styles, {data}) =>{
            return{
                ...styles,
                color:"#fff",
                cursor: 'pointer',
                ':hover':{
                    color:'#fff'
                }

            }
        },
       
    }

    function handleChange(selectedOption,actionMeta){
        console.log('onChange',selectedOption,actionMeta)
        
    }

    const handleInputChange = (inputVale,actionMeta) =>{
        console.log("InputChange",inputVale,actionMeta)

    }
    function colorNewOption(inputVale){
        // const newOption = {
        //     value: inputVale,
        //     label: inputVale, // Use inputValue as both value and label for simplicity
        //     color: "green", // Or whichever color you want to assign
        // };
    }



    const focusCreatable = () => {
        console.log(creatableRef);
        creatableRef.current?.focus();
      };

  return (
    <>
        <CreatableSelect options={options} onInputChange={handleInputChange} 
        onChange={handleChange} isMulti  />
        
    </>
  )
}

export default ReactSelect