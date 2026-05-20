"use client";

import React, { useMemo, useState } from "react";
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

export interface ShopFiltersState {
  categories: string[];
  colors: string[];
  sizes: string[];
  brands: string[];
  priceRange: [number, number];
}

interface FilterProps {
  filters: ShopFiltersState;
  onChange: (next: ShopFiltersState) => void;
  availableCategories?: string[];
  availableSizes?: string[];
  brandsData?: Brand[];
  minPrice?: number;
  maxPrice?: number;
}

const Filter: React.FC<FilterProps> = ({
  filters,
  onChange,
  availableCategories,
  availableSizes,
  brandsData: brandsDataProp,
  minPrice = 0,
  maxPrice = 300}) => {
  const [searchTerm, setSearchTerm] = useState<string>("");

  const brandsData = useMemo<Brand[]>(
    () =>
      brandsDataProp ?? [
        { name: "Adidas", count: 2 },
        { name: "Balmain", count: 7 },
        { name: "Balenciaga", count: 10 },
        { name: "Burberry", count: 39 },
        { name: "Kenzo", count: 95 },
        { name: "Givenchy", count: 1092 },
        { name: "Zara", count: 48 },
      ],
    [brandsDataProp]
  );

  const handleColorChange = (color: string) => {
    const nextColors = filters.colors.includes(color)
      ? filters.colors.filter((c) => c !== color)
      : [...filters.colors, color];
    onChange({ ...filters, colors: nextColors });
  };

  const handleCategoryChange = (category: string) => {
    const nextCategories = filters.categories.includes(category)
      ? filters.categories.filter((c) => c !== category)
      : [...filters.categories, category];
    onChange({ ...filters, categories: nextCategories });
  };

  const handleBrandChange = (brandName: string) => {
    const nextBrands = filters.brands.includes(brandName)
      ? filters.brands.filter((b) => b !== brandName)
      : [...filters.brands, brandName];
    onChange({ ...filters, brands: nextBrands });
  };

  const handleSizeChange = (size: string) => {
    const nextSizes = filters.sizes.includes(size)
      ? filters.sizes.filter((s) => s !== size)
      : [...filters.sizes, size];
    onChange({ ...filters, sizes: nextSizes });
  };

  const handlePriceChange = (_: Event, newValue: number | number[]) => {
    onChange({
      ...filters,
      priceRange: newValue as [number, number]});
  };

  const filteredBrands = brandsData.filter((brand) =>
    brand.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const filterCategories: string[] = availableCategories ?? [
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

  const filterSizes: string[] = availableSizes ?? ["XS", "S", "M", "L", "XL", "XXL"];

  const sliderMin = Math.min(minPrice, maxPrice);
  const sliderMax = Math.max(minPrice, maxPrice);
  const normalizedPriceRange: [number, number] = [
    Math.max(sliderMin, filters.priceRange[0]),
    Math.min(sliderMax, filters.priceRange[1]),
  ];

  if (normalizedPriceRange[0] > normalizedPriceRange[1]) {
    normalizedPriceRange[0] = sliderMin;
    normalizedPriceRange[1] = sliderMax;
  }

  const clearFilters = () => {
    onChange({
      categories: [],
      colors: [],
      sizes: [],
      brands: [],
      priceRange: [sliderMin, sliderMax]});
  };

  return (
    <div className="filterSection">
      <button type="button" className="clearFiltersButton" onClick={clearFilters}>
        Clear filters
      </button>

      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<IoIosArrowDown size={20} />}>
          <h5 className="filterHeading">Product Categories</h5>
        </AccordionSummary>
        <AccordionDetails>
          {filterCategories.map((category, i) => (
            <p
              key={i}
              className={`filterCategoryItem ${
                filters.categories.includes(category) ? "selected" : ""
              }`}
              onClick={() => handleCategoryChange(category)}
            >
              {category}
            </p>
          ))}
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<IoIosArrowDown size={20} />}>
          <h5 className="filterHeading">Color</h5>
        </AccordionSummary>
        <AccordionDetails>
          <div className="filterColorBtn">
            {filterColors.map((color, i) => (
              <button
                key={i}
                className={`colorButton ${filters.colors.includes(color) ? "selected" : ""}`}
                style={{ backgroundColor: color }}
                onClick={() => handleColorChange(color)}
              />
            ))}
          </div>
        </AccordionDetails>
      </Accordion>

      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<IoIosArrowDown size={20} />}>
          <h5 className="filterHeading">Sizes</h5>
        </AccordionSummary>
        <AccordionDetails>
          <div className="sizeButtons">
            {filterSizes.map((size, i) => (
              <button
                key={i}
                className={`sizeButton ${filters.sizes.includes(size) ? "selected" : ""}`}
                onClick={() => handleSizeChange(size)}
              >
                {size}
              </button>
            ))}
          </div>
        </AccordionDetails>
      </Accordion>

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
              onChange={(e: React.ChangeEvent<HTMLInputElement>) => setSearchTerm(e.target.value)}
            />
          </div>

          <div className="brandList">
            {filteredBrands.length > 0 ? (
              filteredBrands.map((brand, i) => (
                <div className="brandItem" key={i}>
                  <input
                    type="checkbox"
                    id={`brand-${i}`}
                    checked={filters.brands.includes(brand.name)}
                    onChange={() => handleBrandChange(brand.name)}
                  />
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

      <Accordion defaultExpanded disableGutters elevation={0}>
        <AccordionSummary expandIcon={<IoIosArrowDown size={20} />}>
          <h5 className="filterHeading">Price</h5>
        </AccordionSummary>
        <AccordionDetails>
          <Slider
            min={sliderMin}
            max={sliderMax}
            value={normalizedPriceRange}
            onChange={handlePriceChange}
            valueLabelDisplay="auto"
            valueLabelFormat={(v) => `$${v}`}
          />

          <div className="filterSliderPrice">
            <p>Min: ${normalizedPriceRange[0]}</p>
            <p>Max: ${normalizedPriceRange[1]}</p>
          </div>
        </AccordionDetails>
      </Accordion>
    </div>
  );
};

export default Filter;
