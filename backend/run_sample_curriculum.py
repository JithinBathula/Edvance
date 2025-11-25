"""
Quick script to generate a sample project curriculum.

Usage:
    python backend/run_sample_curriculum.py
"""

import json
from pathlib import Path
import sys
from dotenv import load_dotenv

PROJECT_ROOT = Path(__file__).resolve().parents[1]
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

from backend.agents.planning import CurriculumPlanner


def main() -> None:
    load_dotenv()

    planner = CurriculumPlanner()
    curriculum = planner.generate_curriculum_json(
        requirements=([
            "Create a CLI platform to manage a small snacks and lemonade stand business.",
    "The application must be modular, split into at least two files: 'store_manager.py' (handling Classes/Logic) and 'main.py' (handling User Input/Loop).",
    "Define a Class (e.g., 'InventoryManager') to handle loading data, saving data, and updating stock.",
    "Load inventory from 'inventory.json'. Schema per item: {'name': str, 'price': float, 'quantity': int}.",
    "If 'inventory.json' does not exist, the program should initialize it with default dummy data (e.g., Lemonade, Cookies) to prevent crashing.",
    "Persist all completed orders to 'orders.json'. Schema per order: {'customer_name': str, 'items': list_of_dicts, 'total_cost': float}.",
    "The 'main.py' file must run a continuous `while` loop displaying the Main Menu: [1. Buy, 2. Manager Report, 3. Exit].",
    "The loop must only break/terminate when the user selects option 3.",
    "Buy Flow Step 1: Ask the user for their 'Customer Name'.",
    "Buy Flow Step 2: Display all inventory items with Name, Price, and current Quantity.",
    "Buy Flow Step 3: Prompt user for 'Item Name' and 'Quantity'.",
    "Validation (Stock): If (Quantity > Available Stock), do not process. Print exactly: 'Error: Insufficient Stock'.",
    "Validation (Input): Use a try/except block to catch non-integer quantity inputs. Print exactly: 'Error: Invalid Quantity' and prompt again.",
    "Validation (Name): If the user enters an item name that doesn't exist, print 'Error: Item not found'.",
    "Upon successful purchase: Deduct stock from the Inventory Class instance.",
    "Immediately save the updated inventory back to 'inventory.json'.",
    "Append the new order to 'orders.json'.",
    "Receipt Output: Print '--- Receipt ---', list the items, and end with 'Total: $X.XX' (formatted to 2 decimal places)."
    "Manager Report: Load all orders from 'orders.json'.",
    "Sort the orders by 'total_cost' in Descending order (highest spender first) using Python's `sorted()` or `.sort()`.",
    "Display the ranked list including Customer Name and Total Spent."]

        ),
        tech_stack=["Python 3.10+ (Standard Library Only)", "JSON (Built-in module for persistence)"],
        experience_level="User name is Alex, a 16-year-old high school student. Alex has a foundational understanding of Object-Oriented Programming (Classes, Methods), Lists, Dictionaries, and basic File I/O. Alex finds technical jargon intimidating and learns best through simplified, non-academic language paired with concrete, real-world analogies. While capable of writing logic, Alex is not yet familiar with web frameworks. The ideal instructional style is patient and encouraging, prioritizing 'small wins' to build momentum.",
    )

    output_path = Path.cwd() / "sample_curriculum_lemonade_stand.json"
    output_path.write_text(json.dumps(curriculum, indent=2))

    print(f"Saved curriculum to {output_path}")
    print(json.dumps(curriculum, indent=2))


if __name__ == "__main__":
    main()
