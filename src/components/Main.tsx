import React, { useState, useEffect, useRef } from 'react';
// import Slider from './Slider';

const Main = () => {

  /*
    슬라이더 자동 이간 시간. useRef는 참조(reference)를 의미하며,
    직접적인 DOM요소 접근, 리렌더링 되도 값 보존. 외부 라이브러리 연동등에 사용된다고 한다.
    setTimeout은 일정시간 후 callback을 실행해줄 수 있는 js function이다.
    즉 slideInterval은 값이 없거나,  일정시간 후 callback을 호출하는 값을 참조하고 있다.
  */
  const [mainSlides, setMainSlides] = useState<any[]>([]);
  const [apisSlides, setApisSlides] = useState<any[]>([]);
  const [kopisSlides, setKopisSlides] = useState<any[]>([]);

  
  const getSlideData = async () => {
    try {

      const mainSlideData = await fetch('http://localhost:8090/api/v1/festivalPosts/slideData');
      const mainData = await mainSlideData.json();
      setMainSlides(mainData);
  
      const categorySlideData = await fetch('http://localhost:8090/api/v1/festivalPosts/getForSlid');
      const categoryData = await categorySlideData.json();

      setApisSlides(categoryData.APIS);
      setKopisSlides(categoryData.KOPIS);

    } catch (error) {
      console.error('슬라이드 데이터를 가져오는 데 실패했습니다:', error);
    }
  };


  useEffect(() => {
    getSlideData();
  }, []);


  return (
    <div className="main-content">
      {/* <Slider slides={mainSlides} title="" autoSlide={true} />
      <Slider slides={apisSlides} title="" autoSlide={false} />
      <Slider slides={kopisSlides} title="" autoSlide={false} /> */}
    </div>
  );
};

export default Main;