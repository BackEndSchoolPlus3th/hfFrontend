function App() {

  console.log(import.meta.env.VITE_CORE_FRONT_BASE_URL);
  console.log(import.meta.env.VITE_CORE_API_BASE_URL);

  fetch(import.meta.env.VITE_CORE_API_BASE_URL + "/api")
    .then((data) => console.log(data));

  return (
    <>
      <h1>Hello World!</h1>
    </>
  )
}

export default App
