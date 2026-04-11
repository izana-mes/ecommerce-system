"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import "./DealTimer.css";

interface Deal {
  id: number;
  name: string;
  price: number;
  discount_price: number;
  end_time: string;
  image: string;
}

interface DealApiResponse {
  id: number;
  name: string;
  price: number;
  discount_price: number;
  end_time: string;
  image: string;
}

type TimeLeft = {
  days: string;
  hours: string;
  minutes: string;
  seconds: string;
};

export default function DealTimer() {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({
    days: "00",
    hours: "00",
    minutes: "00",
    seconds: "00",
  });

  const [isLoad, setIsLoad] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const timeRef = useRef<NodeJS.Timeout | null>(null);

  const calculateTimeLeft = (end_time: string) => {
    const now = new Date();
    const end = new Date(end_time);
    const diff = end.getTime() - now.getTime();

    if (diff <= 0) {
      return {
        days: "00",
        hours: "00",
        minutes: "00",
        seconds: "00",
      };
    }

    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
      .toString()
      .padStart(2, "0");
    const hours = Math.floor((diff / (1000 * 60 * 60)) % 24)
      .toString()
      .padStart(2, "0");
    const minutes = Math.floor((diff / (1000 * 60)) % 60)
      .toString()
      .padStart(2, "0");
    const seconds = Math.floor((diff / 1000) % 60)
      .toString()
      .padStart(2, "0");

    return { days, hours, minutes, seconds };
  };

  const startTime = (end_time: string) => {
    if (timeRef.current) {
      clearInterval(timeRef.current);
    }

    setTimeLeft(calculateTimeLeft(end_time));

    timeRef.current = setInterval(() => {
      const newTimeLeft = calculateTimeLeft(end_time);
      setTimeLeft(newTimeLeft);

      if (
        newTimeLeft.days === "00" &&
        newTimeLeft.hours === "00" &&
        newTimeLeft.minutes === "00" &&
        newTimeLeft.seconds === "00"
      ) {
        if (timeRef.current) {
          clearInterval(timeRef.current);
          timeRef.current = null;
        }
      }
    }, 1000);
  };

  useEffect(() => {
    const fetchDeal = async () => {
      setIsLoad(true);
      setError(null);
      try {
        const res = await fetch(`/api/deals`);
        if (!res.ok) {
          throw new Error("Failed to fetch deal");
        }
        const data: DealApiResponse[] = await res.json();

        if (data.length === 0) {
          setError("No item available");
          setIsLoad(false);
          return;
        }

        // Use the full deal data from the backend
        setDeals(data);

        startTime(data[0].end_time);
      } catch (error) {
        console.error("Error fetching deals:", error);
        setError(error instanceof Error ? error.message : "An error occurred");
      } finally {
        setIsLoad(false);
      }
    };
    fetchDeal();

    return () => {
      if (timeRef.current) {
        clearInterval(timeRef.current);
        timeRef.current = null;
      }
    };
  }, []);

  const scrollToTop = () => {
    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  };

  if (isLoad) {
    return (
      <div className="maiDeal">
        <div className="dealTimer">
          <div className="dealTimerMainContent">
            <p>Loading...</p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="maiDeal">
        <div className="dealTimer">
          <div className="dealTimerMainContent">
            <p>Error : {error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mainDeal">
      <div className="dealTimer">
        <div className="dealTimerMainContent">
          <div className="dealTimerContent">
            <p>DEAL OF THE WEEK</p>
            <h3>
              <span>Spring</span>COLLECTION
            </h3>
            <div className="dealTimerLink">
              <Link href="/" onClick={scrollToTop}>
                <h5>SHOP NOW</h5>
              </Link>
            </div>
          </div>
          <div
            className="dealTimeCounter"
            role="timer"
            aria-live="polite"
            aria-label={`Time remaining: ${timeLeft.days} days, ${timeLeft.hours} hours, ${timeLeft.minutes} minutes, ${timeLeft.seconds} seconds`}
          >
            <div className="dealTimeDigit">
              <h4>{timeLeft.days}</h4>
              <p>days</p>
            </div>
            <h4 aria-hidden="true">:</h4>
            <div className="dealTimeDigit">
              <h4>{timeLeft.hours}</h4>
              <p>hours</p>
            </div>
            <h4 aria-hidden="true">:</h4>
            <div className="dealTimeDigit">
              <h4>{timeLeft.minutes}</h4>
              <p>minutes</p>
            </div>
            <h4 aria-hidden="true">:</h4>
            <div className="dealTimeDigit">
              <h4>{timeLeft.seconds}</h4>
              <p>seconds</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
