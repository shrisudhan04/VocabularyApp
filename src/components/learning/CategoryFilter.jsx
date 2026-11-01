import React from "react";

export default function CategoryFilter({ categories = [], value = "all", onChange }) {
  return <label className="category-filter">Category
    <select value={value} onChange={e => onChange?.(e.target.value)}>
      <option value="all">All categories</option>
      {categories.map(category => <option key={category} value={category}>{category}</option>)}
    </select>
  </label>;
}
