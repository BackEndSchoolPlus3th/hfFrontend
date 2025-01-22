import './App.css'
import KakaoMap from './components/KakaoMap'
import Header from './components/Header'
import Footer from './components/Footer'
import Test from './components/test'
import Main from './components/Main'
import { BrowserRouter, Route, Routes } from 'react-router-dom';//Router 설정


function App() {
  return (
    <BrowserRouter> {/*Router는 사용자 요청에 맞는 Component를 표시해준다 */}
      <div id="commonLayoutComponent" className="commonLayoutContainer">
        <Header />
          <Routes>
            <Route path="/" element={<Main />} />
            <Route path="/Map" element={<KakaoMap />} />
            <Route path="/test" element={<Test />} />
          </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}


export default App
