import React, { useState } from 'react';

function Embedder() {
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState(null);

  const handleChange = (e) => {
    setQuestion(e.target.value);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    setSubmittedQuestion(question);
    setQuestion('');
  };

  return (
    <div className='border text-center'>
      <h1 className=' font-extrabold text-lg mt-4'>Ask a Question</h1>
      <form onSubmit={handleSubmit}>
        
        <input className='border p-2 w-6/12 '
          type="text"
          id="question"
          value={question}
          onChange={handleChange}
          required
        />
        <button type="submit">Submit</button>
      </form>
      {submittedQuestion && (
        <div>
          
          <h2 className='font-extrabold text-lg mt-6'>Answer:</h2>
          <textarea className='w-6/12 border p-2'
            readOnly
            value={question}
            rows="10"
          />
        </div>
      )}
    </div>
  );
}


export default Embedder;
