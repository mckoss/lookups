Exploration of different dictionary lookup techniques for
client-side JavaScript.

Inspired by two blog posts by John Resig:

- [Dictionary Lookups in JavaScript]
- [JavaScript Trie Performance Analysis]

You can try out hosted version of this software at:

- [JavaScript Lookups]
- [Unit Tests].

#Packed Trie Encoding Format

A Packed Trie is an encoding a textual Trie using 7-bit ascii. None of
the character need be quoted themselves when placed inside a
JavaScript string, so dictionaries can be easily including in
JavaScript source files or read via ajax.

## Example

Suppose our dictionary contains the words:

    cat cats dog dogs bat bats rat rats

The corresponding Packed Trie string is:

    b0c0dog1r0
    at0
    !s

*';' characters have been replaced with newlines for clarity.*

This [Trie] (actually, a [DAWG]) has 3 nodes. If we follow the path of
"cats" through the Trie we get the squence:

    node 0. match 'c': continue at node + 1
    node 1. match 'at': continue at node + 1
    node 2. match s: Found!

Or 'dog':

    node 0. match 'dog': continue at node + 2
    node 2. nothing left to match - '!' indicates Found!

## Nodes

A file consists of a sequence of nodes, which are nodes in a Trie
representing a dictionary. Nodes are separated by ';' characters (you
can split(';') to get an array of node strings).

A node string contains an optional '!' first character, which
indicates that this node is a terminal (matching) node in the Trie if
there are zero characters left in the pattern.

The rest of the node is a sequence of character strings. Each string
is either associated with a *node reference*, or is a terminal string
completing a match. *Node references* are base 36.1 encoded relative
node numbers ('0' == +1, '1' == +2, ...). A comma follows each
terminal string to separate it from the next string in the sequence.

A *Node reference* can also be a *symbol* - an absolute node
reference, instead of a relative one.

## Symbols

Large dictionaries can be further compressed by recognizing that node
references to some common suffixes can be quite large (i.e., spanning
1,000's of nodes). While encoded as only 3 or 4 characters, we can
reduce the file size by replacing selected row references with
symbolic references.

To do so, we prepend the file with a collection of symbol definitions:

    0:B9M
    1:B9O
    2:B6R
    3:B6B
    ...
    aA5Kb971c82Ud7FFe6Y5f6E5g5Y7h5IDi58Tj53Xk4XOl4J0m3WMn3N0o38Sp2E3q2BZr1QIs0JFtXHuLPvE2w4Kx41y24zS

When used in a Node, a symbol reference indicates the absolute row
number as defined in it's symbol definition line (above).

For each symbol we define (up to 36), we shift the meaning of all
relative references down by 1. E.g.,if we define 1 symbol ('0'), then
the node reference 1 now means "+1 row", whereas it normally means "+2
rows".

### Base 36.1 numbers

Unlike base 36 numbers (digits 0-9, A-Z), base "36.1" distinguished
between leading zeros. The counting numbers are hence:

    0, 1, 2, 3, ..., 9, A, B, C, ..., Y, Z, 00, 01, 02, ... AA, ...

so we eke out a bit more space by not ignoring leading zeros.

  [Trie]: http://en.wikipedia.org/wiki/Trie
  [DAWG]: http://en.wikipedia.org/wiki/Directed_acyclic_word_graph
  [JavaScript Lookups]: http://lookups.pageforest.com/
  [Unit Tests]: http://lookups.pageforest.com/test/test-runner.html
  [Dictionary Lookups in JavaScript]: http://ejohn.org/blog/dictionary-lookups-in-javascript/
  [JavaScript Trie Performance Analysis]:  http://ejohn.org/blog/javascript-trie-performance-analysis/
