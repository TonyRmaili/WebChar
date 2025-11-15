import React, { useState } from 'react';

function Embedder() {
  const [question, setQuestion] = useState('');
  const [submittedQuestion, setSubmittedQuestion] = useState(null);
  const [answer, setAnswer] = useState('');

  const handleChange = (e) => {
    setQuestion(e.target.value);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmittedQuestion(question);
    await submitQuestion(question);
    setQuestion('');
    console.log("Submitted question: ", question);
  };

  async function submitQuestion(question) {
    try {
      const response = await fetch("http://localhost:8000/query", {
        method: "POST",
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ question: question })
      });
       
      if (response.status === 200) {
        console.log("success!");
        const data = await response.json();
        setAnswer(data.answer);
      } else if (response.status === 400 || response.status === 401) {
        const data = await response.json();
        console.log(data);
      } else {
        console.log("Failed");
      }
    } catch (error) {
      console.error(error);
    }   
  }

  return (
    <div className='border text-center'>
      <h1 className='font-extrabold text-lg mt-4'>Ask a Question</h1>
      <form onSubmit={handleSubmit}>
        <input className='border p-2 w-6/12'
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
            value={answer}
            rows="25"
          />
        </div>
      )}
    </div>
  );
}

export default Embedder;
