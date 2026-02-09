# Setting up the project

## Copy

Copy or clone the repository https://github.com/damianuhx/datian-framework to your server. Make sure the datian-core folder from the external repository is copied, too.



## Adjust 

Create an empty database on your server

Rename the "env-sample.php" file to "env.php"

Change the values for DB_HOST, DB_USER, DB_PASSWORD, DB_NAME to access the database you just created.

Adjust the value for PATH. PATH is the path to the root directory. If the app runs on the root directory set the value to "". If the app runs in a subfolder set the value to "subfolder/".

DEBUG defines if data for troubleshooting is returned or not. Leave this value "true" unless in production mode.



## Adjust the .htdocs file

On this line:
````
RewriteRule ^(.*)$ /datian-framework/index.php?path=$1 [NC,L,QSA]
````

Replace the "datian-framework/" with the value from PATH in the env.php file.



## Test

To check if everything is set up correctly you can call:
http://url-to-the-app/service/test





# Setting up the database

## Define the variable types in settings/database.php

Before the database model can be defined definitions need to be made what type of data is what variable type in the SQL table. This can be defined in the settings/database.php file in the arrays $s and $m2s.

In $m2s variable types can be defined. The key defines how the type is called and the value defines how the value is stored in an SQL database. It is possible that different types (keys) have the same definition. Keys and values are both just names that are used in other places.

```
$m2s = [
'id'=>'none',
'int'=>'int',
'position'=>'int',
'word'=>'varchar',
'bool'=>'bool',
'enum'=>'int',
'email'=>'varchar',
'array'=> 'text',
'fkey'=>'int',
'rkey'=>'none',
'float'=>'float',
'date'=>'date',
'time'=>'time',
'token'=>'varchar',
'timestamp'=>'date',
'password'=>'varchar',
'token'=>'varchar',
];
```

In $s it is defined how each definition from $m2s are defined in SQL syntax.

```
$s=[
    'varchar' => 'VARCHAR(255)',
    'text' => 'VARCHAR(255)',
    'int' => 'INT',
    'bool' => 'INT(1)',
    'date' => 'DATE',
    'time' => 'TIME',
    'float' => 'FLOAT'
];
```

Now we have defined what variable types exist and how the are implemented in the SQL table.



## Define the tables in model

Now we can define the tables defined on these variable types. 

In this example a products and a category table fill be created. A product belongs to one category while a category can have many products (1:n relation). The product table looks like this:

```
$m['product']=[ 
    'id' => ['id'],
    'name' => ['word'],
    'price' => ['int'],
    'category' => ['fkey', 'table'=>'category', 'key'=>'id'],
];
```

id is of type id: This is a special type that is expected in every table and is used vor logic in the background.
'name' is a 'word' which is VARCHAR(255) in the database
'price' is a 'int' (integer) which is INT in the database.
'category' is a 'fkey' (foreign key) which is an INT in the database and can be used to join it with the foreign table.

The category table looks like this:
```
$m['category']=[ 
    'id' => ['id'],
    'name' => ['word'],
    'product' => ['rkey', 'table'=>'product', 'key'=>'category'],
];
```

Category is a 'rkey' which stands for reverse key and is a crucial concept of the Datian framework: It defines that there is a foreign key in the other table that can have multiple entries pointing to this entry. In this case the definition of category is that it has many products that belong to this category. 

The types 'fkey' and 'rkey' both have a 'table' value that defines to what table this relation points to and a 'key' value to define what variable in the foreign table defines the relation.



## Setting up the database

Once everything is defined the database can be automatically set up by calling this route:
http://url-to-the-app/service/migrate
This should create all tables you need for your app.

Once the tables are created and you want to change the database model you can call:
http://url-to-the-app/service/alternate
This will update any variable types that have changed and add variables that are not there yet. It will NOT delete any variables. This has to be done manually.

Before this step: Make sure you have a backup of your database in the case something goes wrong.



## Adding custom SQL to your table definitions

You can add any custom SQL syntax that is executed after the table is created in the $append array. Add any string to the array `$append['tablename']``

This example will add an unique constraint to the table:
```
$append['tablename'][]='ADD CONSTRAINT UC_UserDaySubject UNIQUE (user_id,day,subject)'
```





# Defining the routes

## Calling a route

Routes are defined in the /routes folder. Every call of the framework will be forwarded to the routes folder. We already saw this when accessing /service/migrate or /service/test. In those cases the file migrate.php or test.php in the folder service is called. You can make any folder structure to organize your routes.

The string after a double slash ('//') is treaded as parameters and does not affect the route. 
/service/test//first/second/thirdparameter will call the test.php file in routes and set the $paras array to ['first', 'second', 'thirdparameter'].



## Sending data

Data can be passed as JSON data. In plain text it looks like this:

{
  "name": "testname",
  "price": "77"
}



## Receiving data

Data is returned as a JSON object. 

A global array $return is created at the beginning of every request. 

`$return = ['message'=>'', 'warning'=>'', 'debug'=>[], 'data'=>[], 'log'=>[] ];`

This array can be manipulated and is automatically returned as JSON. 

Debug is only available if DEBUG is true in the env.php file. It holds information about certain events to better understand what happened behind the scenes. You can use the function "inf" anywhere in your code to provide you with additional information.

`function inf($value, $key='')`

$value can be any primitive datatype or array.
$key is an optional key-name of the value when it is returned as JSON. 



If you do not want to return data as a JSON but do something else like displaying a HTML page you can wrap your code in a file in routes/ like this. 

```
ob_end_clean();
//your page code here
exit;
```



## Reading and writing data

There is an all in one function to read data from the database and return the value: serve.
function serve($array, $methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'])
array: The array of data that is read or written
methods: the request methods that are supported. If methods is not set: All request methods are supported.

The products.php file can have one function: 

```
serve(
    [
        'product'=>[
            'name'=>[], 
            'price'=>[],
	        'category'=>[
                'id'=>[]
            ]
        ]
    ]
);
```

The array can also be generated by the 'all' keyword. It takes all values from the models except all rkey values are omitted and the fkey value only has id in it. 

```
serve(
    [
        'product' => ['all']
    ]
); 
```

If you want to also load entries from related table you have to overwrite those instances. In the example below we also want to get the name for the category, after the 'all' keyword a 'category' array is added that will overwrite the category array generated by 'all'.

```
serve(
    [
        'product' => ['all', 'category'=>[
                'name'=>[]
            ]
        ]
    ]
);
```

This function will automatically create all CRUD functions for creating new products. Depending on the request method of the http call it does the following:
POST: A new instance is created. The id property is ommited.
PUT: The entry is updated if there is an id set, a new instance is created if no id is set.
PATCH: The instance is updated
DELETE: The instance is deleted (only the id property is needed for this)
GET: All instances are returned
GET with a single parameter: One entry is returned

Examples:
Create a new product:
POST: `{"name":"testname","price":"77","category":{"id":"1"}}`

GET: Will return all instances of product. If you provide a parameter like `//42` only the instance with id 42 is returned.

DELETE: `{"id":"1"}`


Now lets make a route that returns all categories with their products. 

In create a new file called 'category.php' in routes/ and put the following PHP code in it:

```
serve(
    [
        'category' => ['all', 'product'=>['all']]
    ], ['GET']
);
```

Now you should be able to retrieve any data from the database.



## Adding custom SQL syntax to your query

### Adding a where clause

You can add a SQL where condition to an array with the key "_where". `'_where'=>['price > 100']`.

If you want only retrieve products that cost more than 100 you add this to your array:

```
serve(
    [
        'category' => [
            '_where'=>['price > 100'], 
            'all', 
            'product'=>['all']]
    ], ['GET']
);
```

### Appending any SQL syntax

Grouping, sorting etc. can be added at the end of a SQL query. Datian provides the possibility to define an "_append" array that is appended to the SQL query.

In this example products are sorted by its price:

```
serve(
    [
        'category' => [
            '_where'=>['price > 100'], 
            '_append'=>['ORDER BY price ASC']
            'all', 
            'product'=>['all']]
    ], ['GET']
);
```





# Data manipulation

## Snippets

Snippets are the core concept of executing any operations on the data. Snippets can be used to transform or validate data. Snippets are small code blocks that can be used within any query shown in the previous chapter. 

In the folder snippets all snippets are stored, you can organize them in subfolders if you like. You can include them in your query by adding them to your array. 



## How to apply snippets

The serve function provides an array that will read data from the database. The empty arrays can be filled with snippets. The key defines the location of the code snippet file and the value is passed to that code.

I created a small script that adds a number to the original value and named the file 'add.php' and put it in the snippets/transform/ folder.

To add 100 to a value I write `'transform/add'=>100` inside the array of the variable that has to be transformed. The full code looks like this:

```
serve(
    [
        'product' => ['all', 'price'=>['transform/add'=>100], 'category'=>[
                'name'=>[]
            ]
        ]
    ]
);
```



## Explained by an example

When data is retrieved from or written to sql database after reading or before writing a function (line 191 in datian-core/helper.php) is executed. It includes the code snippet and provides some variables to use within this code: 

- $value: a reference to the value that is returned. If you want to change the value overwrite $value
- $array: a reference to the whole entry (all values).
- $args: the arguments provided in the query. In the sample above `['transform/add'=>100]` $args is 100. You can also provide arrays as argument if you need more than one value. 

The add.php file consists of only one line of code:

```
$value = $value+$args;
```



## Snippets on type or database level

Snippets can not only be included for a value but also for

### 1. The full entity

In the serve function you can add a "_snippet" entry in the array. The snippets are executed for the whole entity, not just one value. This is a good way to create a new variable computed from other variables. If you use snippets like this $value becomes the whole entry while $data is the parent's entry.

### 2. For a datatype

Each datatype defined in settings/database can have snippets defined that are called everytime this datatype is read or written. There are two arrays for this: $in and $out. The snippets defined in $in are called everytime this datatype is written to the database. The snippets defined in $out are called everytime the datatype is read for from the database.

This example checks for all values with datatype 'int' if the value is an integer:

```
$in=[
    'int' => ['validate/type'=>'integer',]
]
```

### 3. Predefined snippets

TBD

### 4. For a specific property in a table

TBD

