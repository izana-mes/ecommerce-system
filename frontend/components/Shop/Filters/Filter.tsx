"use client";

import React, { useState } from "react";
import "./Filter.css";

import Accordion from "@mui/material/Accordion";
import AccordionSummary from "@mui/material/AccordionSummary";
import AccordionDetails from "@mui/material/AccordionDetails";
import Slider from "@mui/material/Slider";

import { IoIosArrowDown } from "react-icons/io";
import { BiSearch } from "react-icons/bi";

interface Brand {
  name: string;
  count: number;
}

const Filter: React.FC = () => {
  const [value, setValue] = useState<[number, number]>([20, 69]);

  const [selectedColors, setSelectedColors] = useState<string[]>([]);
  const [selectedSizes, setSelectedSizes] = useState<string[]>([]);
  const [searchTerm, setSearchTerm] = useState<string>("");

  const [brandsData] = useState<Brand[]>([
    { name: "Adidas", count: 2 },
    { name: "Balmain", count: 7 },
    { name: "Balenciaga", count: 10 },
    { name: "Burberry", count: 39 },
    { name: "Kenzo", count: 95 },
    { name: "Givenchy", count: 1092 },
    { name: "Zara", count: 48 },
  ]);

  const handleColorChange = (color: string) => {
    setSelectedColors((prev) =>
      prev.includes(color)
        ? prev.filter((c) => c !== color)
        : [...prev, color]
    );
  };

  const handleSizeChange = (size: string) => {
    setSelectedSizes((prev) =>
      prev.includes(size)
        ? prev.filter((s) => s !== size)
        : [...prev, size]
    );
  };

  const handleChange = (_: Event, newValue: number | number[]) => {
    setValue(newValue as [number, number]);
  };

  const filteredBrands = brandsData.filter((brand) =>
    brand.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filterCategories: string[] = [
    "Dresses",
    "Shorts",
    "Sweatshirts",
    "Swimwear",
    "Jackets",
    "T-Shirts & Tops",
    "Jeans",
    "Trousers",
    "Men",
    "Jumpers & Cardigans",
  ];

  const filterColors: string[] = [
    "#0B2472",
    "#D6BB4F",
    "#282828",
    "#B0D6E8",
    "#9C7539",
    "#D29B47",
    "#E5AE95",
    "#D76B67",
    "#BABABA",
    "#BFDCC4",
  ];

  const filterSizes: string[] = ["XS", "S", "M", "L", "XL", "XXL"];

  return (
    <div className="filterSection">
      {/* CATEGORY */}
      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<IoIosArrowDown size={20} />}>
          <h5 className="filterHeading">Product Categories</h5>
        </AccordionSummary>
        <AccordionDetails>
          {filterCategories.map((category, i) => (
            <p key={i}>{category}</p>
          ))}
        </AccordionDetails>
      </Accordion>

      {/* COLOR */}
      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<IoIosArrowDown size={20} />}>
          <h5 className="filterHeading">Color</h5>
        </AccordionSummary>
        <AccordionDetails>
          <div className="filterColorBtn">
            {filterColors.map((color, i) => (
              <button
                key={i}
                className={`colorButton ${
                  selectedColors.includes(color) ? "selected" : ""
                }`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorChange(color)}
              />
            ))}
          </div>
        </AccordionDetails>
      </Accordion>

      {/* SIZE */}
      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<IoIosArrowDown size={20} />}>
          <h5 className="filterHeading">Sizes</h5>
        </AccordionSummary>
        <AccordionDetails>
          <div className="sizeButtons">
            {filterSizes.map((size, i) => (
              <button
                key={i}
                className={`sizeButton ${
                  selectedSizes.includes(size) ? "selected" : ""
                }`}
                onClick={() => handleSizeChange(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </AccordionDetails>
      </Accordion>

      {/* BRAND */}
      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<IoIosArrowDown size={20} />}>
          <h5 className="filterHeading">Brands</h5>
        </AccordionSummary>
        <AccordionDetails>
          <div className="searchBar">
            <BiSearch size={20} />
            <input
              type="text"
              placeholder="Search"
              value={searchTerm}
              onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                setSearchTerm(e.target.value)
              }
            />
          </div>

          <div className="brandList">
            {filteredBrands.length > 0 ? (
              filteredBrands.map((brand, i) => (
                <div className="brandItem" key={i}>
                  <input type="checkbox" id={`brand-${i}`} />
                  <label htmlFor={`brand-${i}`}>{brand.name}</label>
                  <span>{brand.count}</span>
                </div>
              ))
            ) : (
              <div>Not found</div>
            )}
          </div>
        </AccordionDetails>
      </Accordion>

      {/* PRICE */}
      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<IoIosArrowDown size={20} />}>
          <h5 className="filterHeading">Price</h5>
        </AccordionSummary>
        <AccordionDetails>
          <Slider
            value={value}
            onChange={handleChange}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `$${v}`}
          />

          <div className="filterSliderPrice">
            <p>Min: ${value[0]}</p>
            <p>Max: ${value[1]}</p>
          </div>
        </AccordionDetails>
      </Accordion>
    </div>
  );
};

export default Filter;